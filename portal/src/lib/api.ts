import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type {
  ApiResponse,
  Hospital,
  HospitalSpecialist,
  SpecialistSchedule,
  VisitFeedback,
  HospitalAdmin,
  AvailabilityStatus,
} from '@/types';

// ── Axios Instance ──────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Auth Token Management ───────────────────────────────────

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token) {
    localStorage.setItem('hg_access_token', token);
  } else {
    localStorage.removeItem('hg_access_token');
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('hg_access_token');
  }
  return accessToken;
}

export function clearTokens(): void {
  accessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('hg_access_token');
    localStorage.removeItem('hg_refresh_token');
  }
}

// ── Request Interceptor ─────────────────────────────────────

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// ── Response Interceptor ────────────────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('hg_refresh_token');
        if (!refreshToken) {
          clearTokens();
          window.location.href = '/login';
          return Promise.reject(error);
        }

        const { data } = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
          refresh_token: refreshToken,
        });

        if (data.success && data.data?.access_token) {
          setAccessToken(data.data.access_token);
          if (data.data.refresh_token) {
            localStorage.setItem('hg_refresh_token', data.data.refresh_token);
          }
          originalRequest.headers.Authorization = `Bearer ${data.data.access_token}`;
          return api(originalRequest);
        }
      } catch {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// ── Auth API ────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ access_token: string; refresh_token: string; admin: HospitalAdmin }>>(
      '/auth/hospital/login',
      { email, password }
    ),

  logout: () => api.post('/auth/logout'),

  getProfile: () =>
    api.get<ApiResponse<HospitalAdmin>>('/auth/profile'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
};

// ── Hospital API ────────────────────────────────────────────

export const hospitalApi = {
  getHospital: (hospitalId: string) =>
    api.get<ApiResponse<Hospital>>(`/hospitals/${hospitalId}`),

  updateHospital: (hospitalId: string, data: Partial<Hospital>) =>
    api.put<ApiResponse<Hospital>>(`/hospitals/${hospitalId}`, data),

  getDashboardStats: (hospitalId: string) =>
    api.get<ApiResponse<{
      total_specialists: number;
      available_count: number;
      busy_count: number;
      off_duty_count: number;
      total_visits_today: number;
      avg_rating: number;
    }>>(`/hospitals/${hospitalId}/dashboard`),
};

// ── Specialist API ──────────────────────────────────────────

export const specialistApi = {
  getAll: (hospitalId: string, params?: { page?: number; limit?: number; search?: string; specialty_id?: string }) =>
    api.get<ApiResponse<HospitalSpecialist[]>>(`/hospitals/${hospitalId}/specialists`, { params }),

  getById: (hospitalId: string, specialistId: string) =>
    api.get<ApiResponse<HospitalSpecialist>>(`/hospitals/${hospitalId}/specialists/${specialistId}`),

  create: (hospitalId: string, data: Partial<HospitalSpecialist>) =>
    api.post<ApiResponse<HospitalSpecialist>>(`/hospitals/${hospitalId}/specialists`, data),

  update: (hospitalId: string, specialistId: string, data: Partial<HospitalSpecialist>) =>
    api.put<ApiResponse<HospitalSpecialist>>(`/hospitals/${hospitalId}/specialists/${specialistId}`, data),

  delete: (hospitalId: string, specialistId: string) =>
    api.delete<ApiResponse<void>>(`/hospitals/${hospitalId}/specialists/${specialistId}`),

  updateStatus: (hospitalId: string, specialistId: string, status: AvailabilityStatus) =>
    api.patch<ApiResponse<HospitalSpecialist>>(
      `/hospitals/${hospitalId}/specialists/${specialistId}/status`,
      { availability_status: status }
    ),
};

// ── Schedule API ────────────────────────────────────────────

export const scheduleApi = {
  getBySpecialist: (hospitalId: string, specialistId: string) =>
    api.get<ApiResponse<SpecialistSchedule[]>>(
      `/hospitals/${hospitalId}/specialists/${specialistId}/schedules`
    ),

  update: (hospitalId: string, specialistId: string, schedules: Partial<SpecialistSchedule>[]) =>
    api.put<ApiResponse<SpecialistSchedule[]>>(
      `/hospitals/${hospitalId}/specialists/${specialistId}/schedules`,
      { schedules }
    ),

  toggleActive: (hospitalId: string, scheduleId: string, isActive: boolean) =>
    api.patch<ApiResponse<SpecialistSchedule>>(
      `/hospitals/${hospitalId}/schedules/${scheduleId}`,
      { is_active: isActive }
    ),
};

// ── Feedback API ────────────────────────────────────────────

export const feedbackApi = {
  getRecent: (hospitalId: string, params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<VisitFeedback[]>>(`/hospitals/${hospitalId}/feedback`, { params }),

  getStats: (hospitalId: string) =>
    api.get<ApiResponse<{
      avg_rating: number;
      avg_wait_time_rating: number;
      avg_staff_rating: number;
      avg_facility_rating: number;
      total_feedback: number;
      would_recommend_pct: number;
    }>>(`/hospitals/${hospitalId}/feedback/stats`),
};

// ── Analytics API ───────────────────────────────────────────

export const analyticsApi = {
  getVisitTrends: (hospitalId: string, params?: { start_date?: string; end_date?: string; interval?: string }) =>
    api.get<ApiResponse<{ date: string; count: number }[]>>(
      `/hospitals/${hospitalId}/analytics/visits`,
      { params }
    ),

  getRatingTrends: (hospitalId: string, params?: { start_date?: string; end_date?: string }) =>
    api.get<ApiResponse<{ date: string; avg_rating: number }[]>>(
      `/hospitals/${hospitalId}/analytics/ratings`,
      { params }
    ),

  getSpecialistUtilization: (hospitalId: string) =>
    api.get<ApiResponse<{ specialist_id: string; doctor_name: string; utilization_pct: number; total_visits: number }[]>>(
      `/hospitals/${hospitalId}/analytics/utilization`
    ),

  getBusiestHours: (hospitalId: string) =>
    api.get<ApiResponse<{ hour: number; avg_visits: number }[]>>(
      `/hospitals/${hospitalId}/analytics/busiest-hours`
    ),
};

export default api;
