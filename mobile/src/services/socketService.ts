// ============================================================
// HealthGuard Mobile - Socket.io Client Service
// ============================================================

import { io, Socket } from 'socket.io-client';
import { API_BASE_PATH, WS_EVENTS } from '../../shared/constants';
import type {
  WSSpecialistUpdate,
  WSEmergencyAlert,
  WSHealthMetricUpdate,
} from '../../shared/types';
import { getAccessToken } from '../api/client';
import { useHospitalStore } from '../store/hospitalStore';
import { useEmergencyStore } from '../store/emergencyStore';

// ── Configuration ─────────────────────────────────────────────

const SOCKET_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://api.healthguard.com';

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

// ── Types ─────────────────────────────────────────────────────

type SpecialistUpdateCallback = (update: WSSpecialistUpdate) => void;
type EmergencyAlertCallback = (alert: WSEmergencyAlert) => void;
type HealthMetricCallback = (metric: WSHealthMetricUpdate) => void;

// ── Service Implementation ────────────────────────────────────

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;

  // External callbacks
  private specialistCallbacks: SpecialistUpdateCallback[] = [];
  private emergencyCallbacks: EmergencyAlertCallback[] = [];
  private healthMetricCallbacks: HealthMetricCallback[] = [];

  /**
   * Connect to the WebSocket server with authentication.
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      console.log('SocketService: Already connected');
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      console.warn('SocketService: No auth token, skipping connection');
      return;
    }

    this.socket = io(SOCKET_URL, {
      path: `${API_BASE_PATH}/ws`,
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: RECONNECT_DELAY,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      timeout: 10000,
    });

    this.setupEventListeners();
  }

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
    }
  }

  /**
   * Join a hospital room for real-time specialist updates.
   */
  joinHospitalRoom(hospitalId: string): void {
    if (!this.socket?.connected) {
      console.warn('SocketService: Not connected, cannot join hospital room');
      return;
    }
    this.socket.emit(WS_EVENTS.JOIN_HOSPITAL_ROOM, { hospital_id: hospitalId });
  }

  /**
   * Leave a hospital room.
   */
  leaveHospitalRoom(hospitalId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit(WS_EVENTS.LEAVE_HOSPITAL_ROOM, { hospital_id: hospitalId });
  }

  /**
   * Join the user's personal room for health updates and emergency alerts.
   */
  joinUserRoom(userId: string): void {
    if (!this.socket?.connected) {
      console.warn('SocketService: Not connected, cannot join user room');
      return;
    }
    this.socket.emit(WS_EVENTS.JOIN_USER_ROOM, { user_id: userId });
  }

  /**
   * Register a callback for specialist status updates.
   * Returns an unsubscribe function.
   */
  onSpecialistUpdate(callback: SpecialistUpdateCallback): () => void {
    this.specialistCallbacks.push(callback);
    return () => {
      this.specialistCallbacks = this.specialistCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  /**
   * Register a callback for emergency alert events.
   * Returns an unsubscribe function.
   */
  onEmergencyAlert(callback: EmergencyAlertCallback): () => void {
    this.emergencyCallbacks.push(callback);
    return () => {
      this.emergencyCallbacks = this.emergencyCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  /**
   * Register a callback for health metric anomaly events.
   * Returns an unsubscribe function.
   */
  onHealthMetric(callback: HealthMetricCallback): () => void {
    this.healthMetricCallbacks.push(callback);
    return () => {
      this.healthMetricCallbacks = this.healthMetricCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  /**
   * Send a health metric update to the server.
   */
  sendHealthMetric(data: {
    metric_type: string;
    value: number;
    is_anomaly: boolean;
  }): void {
    if (!this.socket?.connected) {
      console.warn('SocketService: Not connected, cannot send health metric');
      return;
    }
    this.socket.emit(WS_EVENTS.HEALTH_METRIC_UPDATE, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Check if the socket is currently connected.
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // ── Private Methods ───────────────────────────────────────────

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('SocketService: Connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('SocketService: Disconnected -', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('SocketService: Connection error:', error.message);
      this.reconnectAttempts++;
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log('SocketService: Reconnected after', attemptNumber, 'attempts');
      this.isConnected = true;
    });

    // Business events
    this.socket.on(
      WS_EVENTS.SPECIALIST_STATUS_CHANGED,
      (data: WSSpecialistUpdate) => {
        // Update hospital store
        useHospitalStore
          .getState()
          .updateSpecialistStatus(data.specialist_id, data.availability_status);

        // Notify callbacks
        this.specialistCallbacks.forEach((cb) => {
          try {
            cb(data);
          } catch (err) {
            console.error('SocketService: Error in specialist callback:', err);
          }
        });
      },
    );

    this.socket.on(
      WS_EVENTS.EMERGENCY_ALERT_CREATED,
      (data: WSEmergencyAlert) => {
        // Notify callbacks
        this.emergencyCallbacks.forEach((cb) => {
          try {
            cb(data);
          } catch (err) {
            console.error('SocketService: Error in emergency callback:', err);
          }
        });
      },
    );

    this.socket.on(
      WS_EVENTS.HEALTH_ANOMALY_DETECTED,
      (data: WSHealthMetricUpdate) => {
        // Notify callbacks
        this.healthMetricCallbacks.forEach((cb) => {
          try {
            cb(data);
          } catch (err) {
            console.error('SocketService: Error in health metric callback:', err);
          }
        });
      },
    );

    this.socket.on(WS_EVENTS.HOSPITAL_DATA_UPDATED, () => {
      // Trigger a refresh of hospital data
      console.log('SocketService: Hospital data updated notification received');
    });
  }
}

// ── Singleton Export ──────────────────────────────────────────

export const socketService = new SocketService();
