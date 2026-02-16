// ============================================================
// HealthGuard Mobile - API Endpoint Functions
// ============================================================

import apiClient from './client';
import type {
  ApiResponse,
  User,
  EmergencyContact,
  WearableDevice,
  HealthMetric,
  Hospital,
  Specialty,
  HospitalSpecialist,
  HospitalSearchParams,
  UserVisit,
  VisitFeedback,
  EmergencyAlert,
  AIConversation,
  AIMessage,
  LocationCoordinates,
} from '../../shared/types';

// ── Auth Endpoints ────────────────────────────────────────────

export const authAPI = {
  requestOTP: (phoneNumber: string) =>
    apiClient.post<ApiResponse<{ session_id: string }>>('/auth/otp/request', {
      phone_number: phoneNumber,
    }),

  verifyOTP: (phoneNumber: string, otp: string, sessionId: string) =>
    apiClient.post<
      ApiResponse<{
        user: User;
        access_token: string;
        refresh_token: string;
        is_new_user: boolean;
      }>
    >('/auth/otp/verify', {
      phone_number: phoneNumber,
      otp,
      session_id: sessionId,
    }),

  refreshToken: (refreshToken: string) =>
    apiClient.post<
      ApiResponse<{ access_token: string; refresh_token: string }>
    >('/auth/refresh', {
      refresh_token: refreshToken,
    }),

  logout: () => apiClient.post<ApiResponse<null>>('/auth/logout'),

  getProfile: () => apiClient.get<ApiResponse<User>>('/auth/profile'),

  updateProfile: (data: Partial<User>) =>
    apiClient.put<ApiResponse<User>>('/auth/profile', data),
};

// ── Emergency Contact Endpoints ───────────────────────────────

export const contactsAPI = {
  getContacts: () =>
    apiClient.get<ApiResponse<EmergencyContact[]>>('/contacts'),

  addContact: (data: Omit<EmergencyContact, 'contact_id' | 'user_id' | 'created_at'>) =>
    apiClient.post<ApiResponse<EmergencyContact>>('/contacts', data),

  updateContact: (contactId: string, data: Partial<EmergencyContact>) =>
    apiClient.put<ApiResponse<EmergencyContact>>(`/contacts/${contactId}`, data),

  deleteContact: (contactId: string) =>
    apiClient.delete<ApiResponse<null>>(`/contacts/${contactId}`),
};

// ── Wearable Device Endpoints ─────────────────────────────────

export const wearableAPI = {
  getDevices: () =>
    apiClient.get<ApiResponse<WearableDevice[]>>('/devices'),

  registerDevice: (data: {
    device_type: WearableDevice['device_type'];
    device_token: string;
  }) =>
    apiClient.post<ApiResponse<WearableDevice>>('/devices', data),

  removeDevice: (deviceId: string) =>
    apiClient.delete<ApiResponse<null>>(`/devices/${deviceId}`),

  syncDevice: (deviceId: string) =>
    apiClient.post<ApiResponse<{ synced_at: string }>>(`/devices/${deviceId}/sync`),
};

// ── Health Metrics Endpoints ──────────────────────────────────

export const healthAPI = {
  getMetrics: (params?: {
    metric_type?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<ApiResponse<HealthMetric[]>>('/health/metrics', { params }),

  submitMetric: (data: {
    metric_type: HealthMetric['metric_type'];
    value: number;
    unit: string;
    device_id?: string;
    location_lat?: number;
    location_lng?: number;
  }) =>
    apiClient.post<ApiResponse<HealthMetric>>('/health/metrics', data),

  getLatestMetrics: () =>
    apiClient.get<ApiResponse<Record<string, HealthMetric>>>('/health/metrics/latest'),

  getAnomalies: (params?: { page?: number; limit?: number }) =>
    apiClient.get<ApiResponse<HealthMetric[]>>('/health/anomalies', { params }),
};

// ── Hospital Endpoints ────────────────────────────────────────

export const hospitalAPI = {
  searchHospitals: (params: HospitalSearchParams) =>
    apiClient.get<ApiResponse<Hospital[]>>('/hospitals/search', { params }),

  getHospital: (hospitalId: string) =>
    apiClient.get<ApiResponse<Hospital>>(`/hospitals/${hospitalId}`),

  getSpecialties: () =>
    apiClient.get<ApiResponse<Specialty[]>>('/hospitals/specialties'),

  getHospitalSpecialists: (hospitalId: string, params?: { specialty_id?: string }) =>
    apiClient.get<ApiResponse<HospitalSpecialist[]>>(
      `/hospitals/${hospitalId}/specialists`,
      { params },
    ),

  getNearestER: (location: LocationCoordinates) =>
    apiClient.get<ApiResponse<Hospital>>('/hospitals/nearest-er', {
      params: location,
    }),
};

// ── Visit Endpoints ───────────────────────────────────────────

export const visitAPI = {
  getVisits: (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<ApiResponse<UserVisit[]>>('/visits', { params }),

  getVisit: (visitId: string) =>
    apiClient.get<ApiResponse<UserVisit>>(`/visits/${visitId}`),

  createVisit: (data: {
    hospital_id: string;
    specialist_id?: string;
    visit_date: string;
    visit_type: UserVisit['visit_type'];
    chief_complaint?: string;
  }) =>
    apiClient.post<ApiResponse<UserVisit>>('/visits', data),

  cancelVisit: (visitId: string) =>
    apiClient.put<ApiResponse<UserVisit>>(`/visits/${visitId}/cancel`),

  submitFeedback: (
    visitId: string,
    data: Omit<VisitFeedback, 'feedback_id' | 'visit_id' | 'user_id' | 'submitted_at'>,
  ) =>
    apiClient.post<ApiResponse<VisitFeedback>>(
      `/visits/${visitId}/feedback`,
      data,
    ),
};

// ── Emergency Endpoints ───────────────────────────────────────

export const emergencyAPI = {
  createAlert: (data: {
    alert_type: EmergencyAlert['alert_type'];
    severity: EmergencyAlert['severity'];
    metric_value?: number;
    location_lat?: number;
    location_lng?: number;
    location_address?: string;
  }) =>
    apiClient.post<ApiResponse<EmergencyAlert>>('/emergency/alerts', data),

  getActiveAlerts: () =>
    apiClient.get<ApiResponse<EmergencyAlert[]>>('/emergency/alerts/active'),

  resolveAlert: (alertId: string, status: 'resolved' | 'false_alarm') =>
    apiClient.put<ApiResponse<EmergencyAlert>>(
      `/emergency/alerts/${alertId}/resolve`,
      { alert_status: status },
    ),

  getAlertHistory: (params?: { page?: number; limit?: number }) =>
    apiClient.get<ApiResponse<EmergencyAlert[]>>('/emergency/alerts', { params }),

  notifyContacts: (alertId: string) =>
    apiClient.post<ApiResponse<{ notified_count: number }>>(
      `/emergency/alerts/${alertId}/notify`,
    ),
};

// ── AI Conversation Endpoints ─────────────────────────────────

export const aiAPI = {
  startConversation: (data: {
    conversation_type: AIConversation['conversation_type'];
    emergency_alert_id?: string;
  }) =>
    apiClient.post<ApiResponse<AIConversation>>('/ai/conversations', data),

  getConversation: (conversationId: string) =>
    apiClient.get<ApiResponse<AIConversation & { messages: AIMessage[] }>>(
      `/ai/conversations/${conversationId}`,
    ),

  sendMessage: (conversationId: string, content: string) =>
    apiClient.post<ApiResponse<AIMessage>>(
      `/ai/conversations/${conversationId}/messages`,
      { content },
    ),

  endConversation: (conversationId: string, wasHelpful?: boolean) =>
    apiClient.put<ApiResponse<AIConversation>>(
      `/ai/conversations/${conversationId}/end`,
      { was_helpful: wasHelpful },
    ),

  getConversationHistory: (params?: { page?: number; limit?: number }) =>
    apiClient.get<ApiResponse<AIConversation[]>>('/ai/conversations', { params }),
};
