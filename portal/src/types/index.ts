// ============================================================
// HealthGuard Hospital Portal - Type Definitions
// Re-exports shared types + portal-specific types
// ============================================================

// ── Re-export all shared types ──────────────────────────────

export type {
  User,
  EmergencyContact,
  WearableDevice,
  MetricType,
  HealthMetric,
  Hospital,
  Specialty,
  AvailabilityStatus,
  HospitalSpecialist,
  SpecialistSchedule,
  VisitType,
  VisitStatus,
  UserVisit,
  VisitFeedback,
  AlertType,
  AlertSeverity,
  AlertStatus,
  EmergencyAlert,
  ConversationType,
  AIConversation,
  AIMessage,
  AdminRole,
  HospitalAdmin,
  ApiResponse,
  PaginationInfo,
  LocationCoordinates,
  HospitalSearchParams,
  WSSpecialistUpdate,
  WSEmergencyAlert,
  WSHealthMetricUpdate,
} from '../../shared/types';

// ── Portal-Specific Types ───────────────────────────────────

export interface DashboardStats {
  total_specialists: number;
  available_count: number;
  busy_count: number;
  off_duty_count: number;
  total_visits_today: number;
  avg_rating: number;
}

export interface ChartData {
  date: string;
  value: number;
  label?: string;
}

export interface VisitTrendData {
  date: string;
  count: number;
}

export interface RatingTrendData {
  date: string;
  avg_rating: number;
}

export interface SpecialistUtilization {
  specialist_id: string;
  doctor_name: string;
  utilization_pct: number;
  total_visits: number;
}

export interface BusiestHourData {
  hour: number;
  avg_visits: number;
}

export interface FeedbackStats {
  avg_rating: number;
  avg_wait_time_rating: number;
  avg_staff_rating: number;
  avg_facility_rating: number;
  total_feedback: number;
  would_recommend_pct: number;
}

// ── UI Types ────────────────────────────────────────────────

export interface SidebarNavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export interface SelectOption {
  value: string;
  label: string;
}

// ── Form Types ──────────────────────────────────────────────

export interface SpecialistFormData {
  doctor_name: string;
  specialty_id: string;
  license_number: string;
  consultation_fee: number;
  years_of_experience: number;
}

export interface HospitalFormData {
  hospital_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  phone_number: string;
  email: string;
  website_url: string;
  emergency_services: boolean;
  has_icu: boolean;
  has_trauma_center: boolean;
  trauma_level: string;
  total_beds: number;
}

export interface ScheduleSlot {
  schedule_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

// ── Auth Types ──────────────────────────────────────────────

export interface AuthState {
  admin: import('../../shared/types').HospitalAdmin | null;
  hospitalId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ── Notification Types ──────────────────────────────────────

export interface NotificationPreferences {
  email_alerts: boolean;
  specialist_status_changes: boolean;
  emergency_alerts: boolean;
  feedback_notifications: boolean;
  daily_summary: boolean;
}
