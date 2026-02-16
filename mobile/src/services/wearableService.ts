// ============================================================
// HealthGuard Mobile - Wearable Integration Service
// ============================================================
// Connects to Apple Watch/HealthKit, monitors heart rate in
// real-time, detects anomalies, and triggers emergency alerts
// when heart rate drops below critical threshold (40 BPM).
// ============================================================

import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
} from 'react-native-health';
import { Platform } from 'react-native';
import { HEART_RATE_THRESHOLDS } from '../../shared/constants';
import type { HealthMetric, AlertType, AlertSeverity } from '../../shared/types';
import { useHealthStore } from '../store/healthStore';
import { useEmergencyStore } from '../store/emergencyStore';
import { locationService } from './locationService';

// ── Types ─────────────────────────────────────────────────────

interface AnomalyEvent {
  type: AlertType;
  severity: AlertSeverity;
  value: number;
  timestamp: string;
}

type AnomalyCallback = (event: AnomalyEvent) => void;

interface WearableServiceState {
  isInitialized: boolean;
  isMonitoring: boolean;
  monitoringInterval: ReturnType<typeof setInterval> | null;
  anomalyCallbacks: AnomalyCallback[];
  lastHeartRate: number | null;
  consecutiveAnomalies: number;
}

// ── HealthKit Permissions ─────────────────────────────────────

const HEALTHKIT_PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.BloodPressureSystolic,
      AppleHealthKit.Constants.Permissions.BloodPressureDiastolic,
      AppleHealthKit.Constants.Permissions.OxygenSaturation,
      AppleHealthKit.Constants.Permissions.BodyTemperature,
    ],
    write: [],
  },
};

// ── Monitoring Configuration ──────────────────────────────────

const MONITORING_INTERVAL_MS = 5000; // Read every 5 seconds
const ANOMALY_CONFIRMATION_COUNT = 3; // Require 3 consecutive anomalies before alert
const CRITICAL_IMMEDIATE_THRESHOLD = 2; // Critical alerts after 2 readings

// ── Service Implementation ────────────────────────────────────

class WearableService {
  private state: WearableServiceState = {
    isInitialized: false,
    isMonitoring: false,
    monitoringInterval: null,
    anomalyCallbacks: [],
    lastHeartRate: null,
    consecutiveAnomalies: 0,
  };

  /**
   * Initialize the wearable service and request HealthKit permissions.
   * Must be called before any monitoring can begin.
   */
  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      console.warn('WearableService: HealthKit is only available on iOS');
      return false;
    }

    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(HEALTHKIT_PERMISSIONS, (error: string) => {
        if (error) {
          console.error('WearableService: HealthKit init failed:', error);
          this.state.isInitialized = false;
          resolve(false);
          return;
        }

        this.state.isInitialized = true;
        useHealthStore.getState().setWearableConnected(true);
        console.log('WearableService: HealthKit initialized successfully');
        resolve(true);
      });
    });
  }

  /**
   * Start real-time heart rate monitoring.
   * Reads heart rate at regular intervals and checks for anomalies.
   */
  startMonitoring(): void {
    if (!this.state.isInitialized) {
      console.error('WearableService: Must initialize before monitoring');
      return;
    }

    if (this.state.isMonitoring) {
      console.warn('WearableService: Already monitoring');
      return;
    }

    this.state.isMonitoring = true;
    useHealthStore.getState().setMonitoring(true);

    // Set up background heart rate observation
    this.setupHeartRateObserver();

    // Start polling for latest heart rate
    this.state.monitoringInterval = setInterval(() => {
      this.readLatestHeartRate();
    }, MONITORING_INTERVAL_MS);

    // Read immediately on start
    this.readLatestHeartRate();

    console.log('WearableService: Monitoring started');
  }

  /**
   * Stop heart rate monitoring and clean up resources.
   */
  stopMonitoring(): void {
    if (this.state.monitoringInterval) {
      clearInterval(this.state.monitoringInterval);
      this.state.monitoringInterval = null;
    }

    this.state.isMonitoring = false;
    this.state.consecutiveAnomalies = 0;
    useHealthStore.getState().setMonitoring(false);

    console.log('WearableService: Monitoring stopped');
  }

  /**
   * Get the most recent heart rate reading.
   */
  async getCurrentHeartRate(): Promise<number | null> {
    if (!this.state.isInitialized) {
      return null;
    }

    return new Promise((resolve) => {
      const options = {
        startDate: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Last hour
        limit: 1,
        ascending: false,
      };

      AppleHealthKit.getHeartRateSamples(
        options,
        (error: string, results: HealthValue[]) => {
          if (error || !results || results.length === 0) {
            resolve(this.state.lastHeartRate);
            return;
          }

          const latestBPM = results[0].value;
          this.state.lastHeartRate = latestBPM;
          resolve(latestBPM);
        },
      );
    });
  }

  /**
   * Register a callback for anomaly detection events.
   */
  onAnomalyDetected(callback: AnomalyCallback): () => void {
    this.state.anomalyCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      this.state.anomalyCallbacks = this.state.anomalyCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  // ── Private Methods ───────────────────────────────────────────

  private setupHeartRateObserver(): void {
    if (Platform.OS !== 'ios') return;

    // Use HealthKit observer query for background updates
    AppleHealthKit.setObserver({ type: 'HeartRate' });
  }

  private readLatestHeartRate(): void {
    const options = {
      startDate: new Date(Date.now() - 30 * 1000).toISOString(), // Last 30 seconds
      limit: 1,
      ascending: false,
    };

    AppleHealthKit.getHeartRateSamples(
      options,
      (error: string, results: HealthValue[]) => {
        if (error || !results || results.length === 0) {
          return;
        }

        const bpm = results[0].value;
        this.state.lastHeartRate = bpm;

        // Update store
        const healthStore = useHealthStore.getState();
        healthStore.setCurrentHeartRate(bpm);

        // Build a metric object
        const metric: HealthMetric = {
          metric_id: `local_${Date.now()}`,
          user_id: '',
          metric_type: 'heart_rate',
          value: bpm,
          unit: 'bpm',
          recorded_at: new Date().toISOString(),
          is_anomaly: this.isAnomaly(bpm),
          created_at: new Date().toISOString(),
        };

        healthStore.addHeartRateReading(metric);

        // Check for anomalies
        this.checkForAnomalies(bpm);

        // Submit metric to backend periodically (every 30 seconds)
        if (Date.now() % 30000 < MONITORING_INTERVAL_MS) {
          healthStore.submitMetric('heart_rate', bpm, 'bpm');
        }
      },
    );
  }

  private isAnomaly(bpm: number): boolean {
    return (
      bpm <= HEART_RATE_THRESHOLDS.LOW ||
      bpm >= HEART_RATE_THRESHOLDS.HIGH
    );
  }

  private checkForAnomalies(bpm: number): void {
    if (!this.isAnomaly(bpm)) {
      this.state.consecutiveAnomalies = 0;
      return;
    }

    this.state.consecutiveAnomalies++;

    const anomaly = this.classifyAnomaly(bpm);

    // For critical readings, alert faster
    const threshold =
      anomaly.severity === 'critical'
        ? CRITICAL_IMMEDIATE_THRESHOLD
        : ANOMALY_CONFIRMATION_COUNT;

    if (this.state.consecutiveAnomalies >= threshold) {
      this.triggerAnomalyAlert(anomaly);
      this.state.consecutiveAnomalies = 0;
    }
  }

  private classifyAnomaly(bpm: number): AnomalyEvent {
    let type: AlertType;
    let severity: AlertSeverity;

    if (bpm <= HEART_RATE_THRESHOLDS.CRITICAL_LOW) {
      type = 'low_heart_rate';
      severity = 'critical';
    } else if (bpm <= HEART_RATE_THRESHOLDS.LOW) {
      type = 'low_heart_rate';
      severity = 'high';
    } else if (bpm >= HEART_RATE_THRESHOLDS.CRITICAL_HIGH) {
      type = 'high_heart_rate';
      severity = 'critical';
    } else if (bpm >= HEART_RATE_THRESHOLDS.HIGH) {
      type = 'high_heart_rate';
      severity = 'medium';
    } else {
      type = 'irregular_rhythm';
      severity = 'low';
    }

    return {
      type,
      severity,
      value: bpm,
      timestamp: new Date().toISOString(),
    };
  }

  private async triggerAnomalyAlert(anomaly: AnomalyEvent): Promise<void> {
    console.warn(
      `WearableService: Anomaly detected - ${anomaly.type} (${anomaly.severity}): ${anomaly.value} BPM`,
    );

    // Notify all registered callbacks
    this.state.anomalyCallbacks.forEach((callback) => {
      try {
        callback(anomaly);
      } catch (err) {
        console.error('WearableService: Error in anomaly callback:', err);
      }
    });

    // For critical severity, automatically create an emergency alert
    if (anomaly.severity === 'critical') {
      try {
        const location = await locationService.getCurrentLocation();
        const emergencyStore = useEmergencyStore.getState();

        await emergencyStore.createAlert({
          alert_type: anomaly.type,
          severity: anomaly.severity,
          metric_value: anomaly.value,
          location_lat: location?.latitude,
          location_lng: location?.longitude,
        });

        // Notify emergency contacts
        const currentAlert = emergencyStore.currentAlert;
        if (currentAlert) {
          await emergencyStore.notifyContacts(currentAlert.alert_id);
        }
      } catch (err) {
        console.error('WearableService: Failed to create emergency alert:', err);
      }
    }
  }
}

// ── Singleton Export ──────────────────────────────────────────

export const wearableService = new WearableService();
