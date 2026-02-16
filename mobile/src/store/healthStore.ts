// ============================================================
// HealthGuard Mobile - Health Store (Zustand)
// ============================================================

import { create } from 'zustand';
import type { HealthMetric, WearableDevice, MetricType } from '../../shared/types';
import { HEART_RATE_THRESHOLDS } from '../../shared/constants';
import { healthAPI, wearableAPI } from '../api/endpoints';

interface HealthState {
  // Current metrics
  currentHeartRate: number | null;
  heartRateHistory: HealthMetric[];
  latestMetrics: Record<string, HealthMetric>;
  anomalies: HealthMetric[];

  // Wearable
  connectedDevices: WearableDevice[];
  isWearableConnected: boolean;
  isMonitoring: boolean;
  lastSyncTime: string | null;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrentHeartRate: (bpm: number) => void;
  addHeartRateReading: (metric: HealthMetric) => void;
  fetchHeartRateHistory: (startDate?: string, endDate?: string) => Promise<void>;
  fetchLatestMetrics: () => Promise<void>;
  fetchAnomalies: () => Promise<void>;
  submitMetric: (
    metricType: MetricType,
    value: number,
    unit: string,
    deviceId?: string,
  ) => Promise<void>;

  // Wearable actions
  fetchDevices: () => Promise<void>;
  registerDevice: (
    deviceType: WearableDevice['device_type'],
    deviceToken: string,
  ) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  setWearableConnected: (connected: boolean) => void;
  setMonitoring: (monitoring: boolean) => void;
  updateLastSync: (time: string) => void;

  // Helpers
  getHeartRateStatus: () => 'normal' | 'warning' | 'critical';
  clearError: () => void;
}

export const useHealthStore = create<HealthState>((set, get) => ({
  currentHeartRate: null,
  heartRateHistory: [],
  latestMetrics: {},
  anomalies: [],
  connectedDevices: [],
  isWearableConnected: false,
  isMonitoring: false,
  lastSyncTime: null,
  isLoading: false,
  error: null,

  setCurrentHeartRate: (bpm: number) => {
    set({ currentHeartRate: bpm });
  },

  addHeartRateReading: (metric: HealthMetric) => {
    set((state) => ({
      heartRateHistory: [...state.heartRateHistory.slice(-99), metric],
      currentHeartRate: metric.value,
    }));
  },

  fetchHeartRateHistory: async (startDate?: string, endDate?: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await healthAPI.getMetrics({
        metric_type: 'heart_rate',
        start_date: startDate,
        end_date: endDate,
        limit: 100,
      });
      if (response.data.success && response.data.data) {
        set({ heartRateHistory: response.data.data });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch heart rate history';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchLatestMetrics: async () => {
    try {
      const response = await healthAPI.getLatestMetrics();
      if (response.data.success && response.data.data) {
        set({ latestMetrics: response.data.data });
        // Update current heart rate if available
        const hrMetric = response.data.data.heart_rate;
        if (hrMetric) {
          set({ currentHeartRate: hrMetric.value });
        }
      }
    } catch (err: unknown) {
      console.warn('Failed to fetch latest metrics:', err);
    }
  },

  fetchAnomalies: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await healthAPI.getAnomalies({ limit: 50 });
      if (response.data.success && response.data.data) {
        set({ anomalies: response.data.data });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch anomalies';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  submitMetric: async (metricType, value, unit, deviceId) => {
    try {
      const response = await healthAPI.submitMetric({
        metric_type: metricType,
        value,
        unit,
        device_id: deviceId,
      });
      if (response.data.success && response.data.data) {
        if (metricType === 'heart_rate') {
          get().addHeartRateReading(response.data.data);
        }
      }
    } catch (err: unknown) {
      console.warn('Failed to submit metric:', err);
    }
  },

  fetchDevices: async () => {
    try {
      const response = await wearableAPI.getDevices();
      if (response.data.success && response.data.data) {
        const devices = response.data.data;
        set({
          connectedDevices: devices,
          isWearableConnected: devices.some((d) => d.is_active),
        });
      }
    } catch (err: unknown) {
      console.warn('Failed to fetch devices:', err);
    }
  },

  registerDevice: async (deviceType, deviceToken) => {
    try {
      set({ isLoading: true, error: null });
      const response = await wearableAPI.registerDevice({
        device_type: deviceType,
        device_token: deviceToken,
      });
      if (response.data.success && response.data.data) {
        set((state) => ({
          connectedDevices: [...state.connectedDevices, response.data.data!],
          isWearableConnected: true,
        }));
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to register device';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  removeDevice: async (deviceId: string) => {
    try {
      set({ isLoading: true, error: null });
      await wearableAPI.removeDevice(deviceId);
      set((state) => {
        const remaining = state.connectedDevices.filter(
          (d) => d.device_id !== deviceId,
        );
        return {
          connectedDevices: remaining,
          isWearableConnected: remaining.some((d) => d.is_active),
        };
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to remove device';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  setWearableConnected: (connected: boolean) => {
    set({ isWearableConnected: connected });
  },

  setMonitoring: (monitoring: boolean) => {
    set({ isMonitoring: monitoring });
  },

  updateLastSync: (time: string) => {
    set({ lastSyncTime: time });
  },

  getHeartRateStatus: () => {
    const { currentHeartRate } = get();
    if (currentHeartRate === null) return 'normal';

    if (
      currentHeartRate <= HEART_RATE_THRESHOLDS.CRITICAL_LOW ||
      currentHeartRate >= HEART_RATE_THRESHOLDS.CRITICAL_HIGH
    ) {
      return 'critical';
    }

    if (
      currentHeartRate <= HEART_RATE_THRESHOLDS.LOW ||
      currentHeartRate >= HEART_RATE_THRESHOLDS.HIGH
    ) {
      return 'warning';
    }

    return 'normal';
  },

  clearError: () => set({ error: null }),
}));
