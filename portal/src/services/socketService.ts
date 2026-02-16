import { io, Socket } from 'socket.io-client';
import { WS_EVENTS } from '@shared/constants';
import type { WSSpecialistUpdate, WSEmergencyAlert } from '@shared/types';
import { getAccessToken } from '@/lib/api';

// ── Socket Service ──────────────────────────────────────────

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private hospitalId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // ── Connection Management ───────────────────────────────

  connect(hospitalId: string): Socket {
    if (this.socket?.connected && this.hospitalId === hospitalId) {
      return this.socket;
    }

    // Disconnect existing connection if switching hospitals
    if (this.socket) {
      this.disconnect();
    }

    this.hospitalId = hospitalId;
    this.reconnectAttempts = 0;

    this.socket = io(WS_URL, {
      auth: {
        token: getAccessToken(),
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.setupDefaultListeners();
    this.joinHospitalRoom(hospitalId);

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      if (this.hospitalId) {
        this.socket.emit(WS_EVENTS.LEAVE_HOSPITAL_ROOM, {
          hospital_id: this.hospitalId,
        });
      }
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.hospitalId = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ── Room Management ─────────────────────────────────────

  private joinHospitalRoom(hospitalId: string): void {
    if (this.socket) {
      this.socket.emit(WS_EVENTS.JOIN_HOSPITAL_ROOM, {
        hospital_id: hospitalId,
      });
    }
  }

  // ── Default Listeners ───────────────────────────────────

  private setupDefaultListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[SocketService] Connected to WebSocket server');
      this.reconnectAttempts = 0;

      // Rejoin hospital room on reconnect
      if (this.hospitalId) {
        this.joinHospitalRoom(this.hospitalId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[SocketService] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      console.error(
        `[SocketService] Connection error (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}):`,
        error.message
      );
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log('[SocketService] Reconnected after', attemptNumber, 'attempts');
    });
  }

  // ── Event Subscription ──────────────────────────────────

  onSpecialistStatusChanged(callback: (data: WSSpecialistUpdate) => void): void {
    this.socket?.on(WS_EVENTS.SPECIALIST_STATUS_CHANGED, callback);
  }

  offSpecialistStatusChanged(callback: (data: WSSpecialistUpdate) => void): void {
    this.socket?.off(WS_EVENTS.SPECIALIST_STATUS_CHANGED, callback);
  }

  onEmergencyAlert(callback: (data: WSEmergencyAlert) => void): void {
    this.socket?.on(WS_EVENTS.EMERGENCY_ALERT_CREATED, callback);
  }

  offEmergencyAlert(callback: (data: WSEmergencyAlert) => void): void {
    this.socket?.off(WS_EVENTS.EMERGENCY_ALERT_CREATED, callback);
  }

  onEmergencyResolved(callback: (data: { alert_id: string }) => void): void {
    this.socket?.on(WS_EVENTS.EMERGENCY_ALERT_RESOLVED, callback);
  }

  offEmergencyResolved(callback: (data: { alert_id: string }) => void): void {
    this.socket?.off(WS_EVENTS.EMERGENCY_ALERT_RESOLVED, callback);
  }

  onHospitalDataUpdated(callback: (data: { hospital_id: string }) => void): void {
    this.socket?.on(WS_EVENTS.HOSPITAL_DATA_UPDATED, callback);
  }

  offHospitalDataUpdated(callback: (data: { hospital_id: string }) => void): void {
    this.socket?.off(WS_EVENTS.HOSPITAL_DATA_UPDATED, callback);
  }

  // ── Generic Event Helpers ───────────────────────────────

  on(event: string, callback: (...args: unknown[]) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    this.socket?.off(event, callback);
  }

  emit(event: string, data?: unknown): void {
    this.socket?.emit(event, data);
  }
}

// Singleton instance
const socketService = new SocketService();
export default socketService;
