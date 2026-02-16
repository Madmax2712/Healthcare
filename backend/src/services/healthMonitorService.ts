import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import {
  HealthMetric,
  MetricType,
  EmergencyAlert,
  AlertType,
  AlertSeverity,
} from '../../../shared/types';
import {
  HEART_RATE_THRESHOLDS,
  SPO2_THRESHOLDS,
  ALERT_SEVERITY_MAP,
} from '../../../shared/constants';
import notificationService from './notificationService';
import logger from '../utils/logger';

interface MetricInput {
  metric_type: MetricType;
  value: number;
  unit: string;
  device_id?: string;
  recorded_at: string;
  location_lat?: number;
  location_lng?: number;
}

interface AnomalyResult {
  isAnomaly: boolean;
  alertType?: AlertType;
  severity?: AlertSeverity;
}

/**
 * Health monitoring service - processes wearable metrics,
 * detects anomalies, and triggers emergency alerts when
 * critical thresholds are breached.
 */
class HealthMonitorService {
  /**
   * Process an incoming health metric from a wearable device.
   * Stores the metric, checks for anomalies, and triggers alerts if needed.
   */
  async processMetric(userId: string, input: MetricInput): Promise<HealthMetric> {
    const anomaly = this.detectAnomalies(input.metric_type, input.value);
    const metricId = uuidv4();

    const [metric] = await db('health_metrics')
      .insert({
        metric_id: metricId,
        user_id: userId,
        device_id: input.device_id || null,
        metric_type: input.metric_type,
        value: input.value,
        unit: input.unit,
        recorded_at: input.recorded_at,
        location_lat: input.location_lat || null,
        location_lng: input.location_lng || null,
        is_anomaly: anomaly.isAnomaly,
        created_at: new Date().toISOString(),
      })
      .returning('*');

    logger.info('Health metric processed', {
      metricId,
      userId,
      type: input.metric_type,
      value: input.value,
      isAnomaly: anomaly.isAnomaly,
    });

    // If an anomaly is detected, create an emergency alert
    if (anomaly.isAnomaly && anomaly.alertType && anomaly.severity) {
      await this.createEmergencyAlert(userId, {
        alertType: anomaly.alertType,
        severity: anomaly.severity,
        metricValue: input.value,
        locationLat: input.location_lat,
        locationLng: input.location_lng,
      });
    }

    return metric;
  }

  /**
   * Detect anomalies in health metrics based on predefined thresholds.
   * Uses the shared HEART_RATE_THRESHOLDS and SPO2_THRESHOLDS constants.
   */
  detectAnomalies(metricType: MetricType, value: number): AnomalyResult {
    switch (metricType) {
      case 'heart_rate':
        return this.detectHeartRateAnomaly(value);
      case 'spo2':
        return this.detectSpO2Anomaly(value);
      case 'temperature':
        return this.detectTemperatureAnomaly(value);
      default:
        return { isAnomaly: false };
    }
  }

  /**
   * Detect heart rate anomalies using threshold constants.
   * Critical alert when heart rate drops below 40 BPM.
   */
  private detectHeartRateAnomaly(value: number): AnomalyResult {
    if (value < HEART_RATE_THRESHOLDS.CRITICAL_LOW) {
      return {
        isAnomaly: true,
        alertType: 'low_heart_rate',
        severity: 'critical',
      };
    }

    if (value < HEART_RATE_THRESHOLDS.LOW) {
      return {
        isAnomaly: true,
        alertType: 'low_heart_rate',
        severity: 'high',
      };
    }

    if (value < HEART_RATE_THRESHOLDS.NORMAL_LOW) {
      return {
        isAnomaly: true,
        alertType: 'low_heart_rate',
        severity: 'medium',
      };
    }

    if (value > HEART_RATE_THRESHOLDS.CRITICAL_HIGH) {
      return {
        isAnomaly: true,
        alertType: 'high_heart_rate',
        severity: 'critical',
      };
    }

    if (value > HEART_RATE_THRESHOLDS.HIGH) {
      return {
        isAnomaly: true,
        alertType: 'high_heart_rate',
        severity: 'high',
      };
    }

    if (value > HEART_RATE_THRESHOLDS.NORMAL_HIGH) {
      return {
        isAnomaly: true,
        alertType: 'high_heart_rate',
        severity: 'medium',
      };
    }

    return { isAnomaly: false };
  }

  /**
   * Detect SpO2 anomalies.
   */
  private detectSpO2Anomaly(value: number): AnomalyResult {
    if (value < SPO2_THRESHOLDS.CRITICAL_LOW) {
      return {
        isAnomaly: true,
        alertType: 'low_spo2',
        severity: 'critical',
      };
    }

    if (value < SPO2_THRESHOLDS.LOW) {
      return {
        isAnomaly: true,
        alertType: 'low_spo2',
        severity: 'high',
      };
    }

    if (value < SPO2_THRESHOLDS.NORMAL) {
      return {
        isAnomaly: true,
        alertType: 'low_spo2',
        severity: 'medium',
      };
    }

    return { isAnomaly: false };
  }

  /**
   * Detect temperature anomalies.
   */
  private detectTemperatureAnomaly(value: number): AnomalyResult {
    // Temperature in Fahrenheit
    if (value < 95.0 || value > 104.0) {
      return {
        isAnomaly: true,
        alertType: 'irregular_rhythm', // Closest alert type for temperature extremes
        severity: value < 93.0 || value > 106.0 ? 'critical' : 'high',
      };
    }

    return { isAnomaly: false };
  }

  /**
   * Create an emergency alert and notify emergency contacts.
   */
  async createEmergencyAlert(
    userId: string,
    data: {
      alertType: AlertType;
      severity: AlertSeverity;
      metricValue?: number;
      locationLat?: number;
      locationLng?: number;
      locationAddress?: string;
    }
  ): Promise<EmergencyAlert> {
    const alertId = uuidv4();

    const [alert] = await db('emergency_alerts')
      .insert({
        alert_id: alertId,
        user_id: userId,
        alert_type: data.alertType,
        severity: data.severity,
        metric_value: data.metricValue || null,
        location_lat: data.locationLat || null,
        location_lng: data.locationLng || null,
        location_address: data.locationAddress || null,
        alert_status: 'active',
        created_at: new Date().toISOString(),
      })
      .returning('*');

    logger.warn('Emergency alert created', {
      alertId,
      userId,
      alertType: data.alertType,
      severity: data.severity,
      metricValue: data.metricValue,
    });

    // For critical alerts, notify emergency contacts immediately
    if (data.severity === 'critical') {
      await this.notifyEmergencyContacts(userId, alert);
    }

    return alert;
  }

  /**
   * Notify all emergency contacts for a user about a critical alert.
   * Sends SMS and push notifications with location data.
   */
  async notifyEmergencyContacts(
    userId: string,
    alert: EmergencyAlert
  ): Promise<void> {
    try {
      const contacts = await db('emergency_contacts')
        .where('user_id', userId)
        .orderBy('is_primary', 'desc');

      if (contacts.length === 0) {
        logger.warn('No emergency contacts found for user', { userId, alertId: alert.alert_id });
        return;
      }

      const user = await db('users').where('user_id', userId).first();
      const userName = user?.full_name || 'A HealthGuard user';

      const notifiedContactIds: string[] = [];

      for (const contact of contacts) {
        try {
          await notificationService.sendEmergencyAlert({
            contactPhone: contact.phone_number,
            contactName: contact.contact_name,
            userName,
            alertType: alert.alert_type,
            severity: alert.severity,
            metricValue: alert.metric_value,
            locationLat: alert.location_lat,
            locationLng: alert.location_lng,
            locationAddress: alert.location_address,
          });

          notifiedContactIds.push(contact.contact_id);
        } catch (error) {
          logger.error('Failed to notify emergency contact', {
            contactId: contact.contact_id,
            alertId: alert.alert_id,
            error,
          });
        }
      }

      // Update alert with notified contacts
      await db('emergency_alerts')
        .where('alert_id', alert.alert_id)
        .update({
          notified_contacts: JSON.stringify(notifiedContactIds),
          notified_at: new Date().toISOString(),
        });

      logger.info('Emergency contacts notified', {
        alertId: alert.alert_id,
        contactCount: notifiedContactIds.length,
      });
    } catch (error) {
      logger.error('Failed to notify emergency contacts', {
        userId,
        alertId: alert.alert_id,
        error,
      });
      throw error;
    }
  }

  /**
   * Get health metrics for a user with optional filtering.
   */
  async getUserMetrics(
    userId: string,
    options: {
      metricType?: MetricType;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ metrics: HealthMetric[]; total: number }> {
    let query = db('health_metrics').where('user_id', userId);

    if (options.metricType) {
      query = query.where('metric_type', options.metricType);
    }

    if (options.startDate) {
      query = query.where('recorded_at', '>=', options.startDate);
    }

    if (options.endDate) {
      query = query.where('recorded_at', '<=', options.endDate);
    }

    const [{ count }] = await query.clone().count('* as count');
    const total = parseInt(count as string, 10);

    const metrics = await query
      .orderBy('recorded_at', 'desc')
      .limit(options.limit || 50)
      .offset(options.offset || 0);

    return { metrics, total };
  }

  /**
   * Get emergency alerts for a user.
   */
  async getUserAlerts(
    userId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<EmergencyAlert[]> {
    let query = db('emergency_alerts').where('user_id', userId);

    if (options.status) {
      query = query.where('alert_status', options.status);
    }

    return query
      .orderBy('created_at', 'desc')
      .limit(options.limit || 50)
      .offset(options.offset || 0);
  }

  /**
   * Update the status of an emergency alert.
   */
  async updateAlertStatus(
    alertId: string,
    status: 'acknowledged' | 'resolved' | 'false_alarm'
  ): Promise<EmergencyAlert | null> {
    const updates: Record<string, unknown> = { alert_status: status };

    if (status === 'resolved' || status === 'false_alarm') {
      updates.resolved_at = new Date().toISOString();
    }

    const [updated] = await db('emergency_alerts')
      .where('alert_id', alertId)
      .update(updates)
      .returning('*');

    if (updated) {
      logger.info('Alert status updated', { alertId, status });
    }

    return updated || null;
  }
}

export default new HealthMonitorService();
