'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import socketService from '@/services/socketService';
import type { WSSpecialistUpdate, WSEmergencyAlert } from '@/types';
import { useAuthStore } from '@/hooks/useAuth';

// ── Socket Hook ─────────────────────────────────────────────

interface UseSocketOptions {
  onSpecialistStatusChanged?: (data: WSSpecialistUpdate) => void;
  onEmergencyAlert?: (data: WSEmergencyAlert) => void;
  onEmergencyResolved?: (data: { alert_id: string }) => void;
  onHospitalDataUpdated?: (data: { hospital_id: string }) => void;
  autoConnect?: boolean;
}

interface UseSocketReturn {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const {
    onSpecialistStatusChanged,
    onEmergencyAlert,
    onEmergencyResolved,
    onHospitalDataUpdated,
    autoConnect = true,
  } = options;

  const hospitalId = useAuthStore((state) => state.hospitalId);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isConnected, setIsConnected] = useState(false);

  // Store callbacks in refs to avoid reconnects on callback changes
  const callbackRefs = useRef(options);
  callbackRefs.current = {
    onSpecialistStatusChanged,
    onEmergencyAlert,
    onEmergencyResolved,
    onHospitalDataUpdated,
  };

  const connect = useCallback(() => {
    if (!hospitalId || !isAuthenticated) return;

    const socket = socketService.connect(hospitalId);

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Attach event listeners
    if (callbackRefs.current.onSpecialistStatusChanged) {
      socketService.onSpecialistStatusChanged(callbackRefs.current.onSpecialistStatusChanged);
    }
    if (callbackRefs.current.onEmergencyAlert) {
      socketService.onEmergencyAlert(callbackRefs.current.onEmergencyAlert);
    }
    if (callbackRefs.current.onEmergencyResolved) {
      socketService.onEmergencyResolved(callbackRefs.current.onEmergencyResolved);
    }
    if (callbackRefs.current.onHospitalDataUpdated) {
      socketService.onHospitalDataUpdated(callbackRefs.current.onHospitalDataUpdated);
    }

    setIsConnected(socket.connected);
  }, [hospitalId, isAuthenticated]);

  const disconnect = useCallback(() => {
    socketService.disconnect();
    setIsConnected(false);
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && hospitalId && isAuthenticated) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, hospitalId, isAuthenticated, connect, disconnect]);

  return {
    isConnected,
    connect,
    disconnect,
  };
}

export default useSocket;
