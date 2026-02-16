// ============================================================
// HealthGuard Mobile - Emergency Store (Zustand)
// ============================================================

import { create } from 'zustand';
import type { EmergencyAlert, LocationCoordinates } from '../../shared/types';
import { emergencyAPI } from '../api/endpoints';

interface ContactNotificationStatus {
  contactId: string;
  contactName: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
}

interface EmergencyState {
  // Alerts
  activeAlerts: EmergencyAlert[];
  alertHistory: EmergencyAlert[];
  currentAlert: EmergencyAlert | null;

  // Contact notifications
  contactNotifications: ContactNotificationStatus[];

  // Emergency state
  isEmergencyActive: boolean;
  isCallingServices: boolean;
  currentLocation: LocationCoordinates | null;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  createAlert: (data: {
    alert_type: EmergencyAlert['alert_type'];
    severity: EmergencyAlert['severity'];
    metric_value?: number;
    location_lat?: number;
    location_lng?: number;
    location_address?: string;
  }) => Promise<EmergencyAlert | null>;

  fetchActiveAlerts: () => Promise<void>;
  fetchAlertHistory: () => Promise<void>;

  resolveAlert: (
    alertId: string,
    status: 'resolved' | 'false_alarm',
  ) => Promise<void>;

  notifyContacts: (alertId: string) => Promise<void>;

  // State management
  setEmergencyActive: (active: boolean) => void;
  setCallingServices: (calling: boolean) => void;
  setCurrentLocation: (location: LocationCoordinates | null) => void;
  setCurrentAlert: (alert: EmergencyAlert | null) => void;
  updateContactNotification: (
    contactId: string,
    status: ContactNotificationStatus['status'],
  ) => void;
  addContactNotification: (notification: ContactNotificationStatus) => void;

  clearEmergency: () => void;
  clearError: () => void;
}

export const useEmergencyStore = create<EmergencyState>((set, get) => ({
  activeAlerts: [],
  alertHistory: [],
  currentAlert: null,
  contactNotifications: [],
  isEmergencyActive: false,
  isCallingServices: false,
  currentLocation: null,
  isLoading: false,
  error: null,

  createAlert: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const response = await emergencyAPI.createAlert(data);
      if (response.data.success && response.data.data) {
        const alert = response.data.data;
        set((state) => ({
          activeAlerts: [...state.activeAlerts, alert],
          currentAlert: alert,
          isEmergencyActive: true,
        }));
        return alert;
      }
      return null;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create emergency alert';
      set({ error: message });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchActiveAlerts: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await emergencyAPI.getActiveAlerts();
      if (response.data.success && response.data.data) {
        const alerts = response.data.data;
        set({
          activeAlerts: alerts,
          isEmergencyActive: alerts.length > 0,
          currentAlert: alerts.length > 0 ? alerts[0] : null,
        });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch active alerts';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAlertHistory: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await emergencyAPI.getAlertHistory({ limit: 50 });
      if (response.data.success && response.data.data) {
        set({ alertHistory: response.data.data });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch alert history';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  resolveAlert: async (alertId, status) => {
    try {
      set({ isLoading: true, error: null });
      const response = await emergencyAPI.resolveAlert(alertId, status);
      if (response.data.success && response.data.data) {
        const resolved = response.data.data;
        set((state) => ({
          activeAlerts: state.activeAlerts.filter(
            (a) => a.alert_id !== alertId,
          ),
          currentAlert:
            state.currentAlert?.alert_id === alertId ? null : state.currentAlert,
          isEmergencyActive:
            state.activeAlerts.filter((a) => a.alert_id !== alertId).length > 0,
          alertHistory: [resolved, ...state.alertHistory],
        }));
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to resolve alert';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  notifyContacts: async (alertId: string) => {
    try {
      const response = await emergencyAPI.notifyContacts(alertId);
      if (response.data.success) {
        // Update notification statuses - contacts will be tracked via socket updates
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to notify contacts';
      set({ error: message });
    }
  },

  setEmergencyActive: (active: boolean) => {
    set({ isEmergencyActive: active });
  },

  setCallingServices: (calling: boolean) => {
    set({ isCallingServices: calling });
  },

  setCurrentLocation: (location: LocationCoordinates | null) => {
    set({ currentLocation: location });
  },

  setCurrentAlert: (alert: EmergencyAlert | null) => {
    set({ currentAlert: alert });
  },

  updateContactNotification: (contactId, status) => {
    set((state) => ({
      contactNotifications: state.contactNotifications.map((n) =>
        n.contactId === contactId ? { ...n, status } : n,
      ),
    }));
  },

  addContactNotification: (notification: ContactNotificationStatus) => {
    set((state) => ({
      contactNotifications: [...state.contactNotifications, notification],
    }));
  },

  clearEmergency: () => {
    set({
      isEmergencyActive: false,
      isCallingServices: false,
      currentAlert: null,
      contactNotifications: [],
    });
  },

  clearError: () => set({ error: null }),
}));
