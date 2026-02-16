// ============================================================
// HealthGuard Platform - Shared Type Definitions
// ============================================================

// ── User Types ──────────────────────────────────────────────

export interface User {
  user_id: string;
  phone_number: string;
  email?: string;
  full_name: string;
  date_of_birth?: string;
  blood_type?: string;
  allergies?: string[];
  medical_conditions?: string[];
  profile_picture_url?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  last_login?: string;
}

export interface EmergencyContact {
  contact_id: string;
  user_id: string;
  contact_name: string;
  phone_number: string;
  relationship?: string;
  is_primary: boolean;
  created_at: string;
}

// ── Wearable & Health Types ─────────────────────────────────

export interface WearableDevice {
  device_id: string;
  user_id: string;
  device_type: 'apple_watch' | 'fitbit' | 'oura' | 'samsung_galaxy_watch' | 'garmin';
  device_token: string;
  is_active: boolean;
  last_sync?: string;
  created_at: string;
}

export type MetricType = 'heart_rate' | 'blood_pressure' | 'spo2' | 'temperature' | 'steps';

export interface HealthMetric {
  metric_id: string;
  user_id: string;
  device_id?: string;
  metric_type: MetricType;
  value: number;
  unit: string;
  recorded_at: string;
  location_lat?: number;
  location_lng?: number;
  is_anomaly: boolean;
  created_at: string;
}

// ── Hospital Types ──────────────────────────────────────────

export interface Hospital {
  hospital_id: string;
  hospital_name: string;
  address: string;
  city: string;
  state: string;
  zip_code?: string;
  country: string;
  latitude: number;
  longitude: number;
  phone_number: string;
  email?: string;
  website_url?: string;
  emergency_services: boolean;
  has_icu: boolean;
  has_trauma_center: boolean;
  trauma_level?: string;
  total_beds?: number;
  rating?: number;
  distance?: number; // calculated field
  created_at: string;
  updated_at: string;
}

export interface Specialty {
  specialty_id: string;
  specialty_name: string;
  specialty_code: string;
  description?: string;
  icon_url?: string;
  is_emergency: boolean;
  display_order?: number;
}

export type AvailabilityStatus = 'available' | 'busy' | 'off_duty';

export interface HospitalSpecialist {
  specialist_id: string;
  hospital_id: string;
  specialty_id: string;
  doctor_name: string;
  license_number?: string;
  is_available: boolean;
  availability_status: AvailabilityStatus;
  next_available_slot?: string;
  consultation_fee?: number;
  years_of_experience?: number;
  specialty?: Specialty;
  hospital?: Hospital;
  created_at: string;
  updated_at: string;
}

export interface SpecialistSchedule {
  schedule_id: string;
  specialist_id: string;
  day_of_week: number; // 0=Sunday, 6=Saturday
  start_time: string;
  end_time: string;
  is_active: boolean;
}

// ── Visit Types ─────────────────────────────────────────────

export type VisitType = 'emergency' | 'scheduled' | 'walk_in';
export type VisitStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export interface UserVisit {
  visit_id: string;
  user_id: string;
  hospital_id: string;
  specialist_id?: string;
  visit_date: string;
  visit_type: VisitType;
  chief_complaint?: string;
  diagnosis?: string;
  prescription?: string;
  notes?: string;
  status: VisitStatus;
  hospital?: Hospital;
  specialist?: HospitalSpecialist;
  feedback?: VisitFeedback;
  created_at: string;
  updated_at: string;
}

export interface VisitFeedback {
  feedback_id: string;
  visit_id: string;
  user_id: string;
  rating: number;
  wait_time_rating: number;
  staff_rating: number;
  facility_rating: number;
  comments?: string;
  would_recommend: boolean;
  submitted_at: string;
}

// ── Emergency Types ─────────────────────────────────────────

export type AlertType = 'low_heart_rate' | 'high_heart_rate' | 'fall_detected' | 'irregular_rhythm' | 'low_spo2';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'false_alarm';

export interface EmergencyAlert {
  alert_id: string;
  user_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  metric_value?: number;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
  alert_status: AlertStatus;
  notified_contacts?: string[];
  notified_at?: string;
  resolved_at?: string;
  created_at: string;
}

// ── AI Conversation Types ───────────────────────────────────

export type ConversationType = 'emergency_guidance' | 'triage' | 'general_health';

export interface AIConversation {
  conversation_id: string;
  user_id: string;
  emergency_alert_id?: string;
  conversation_type: ConversationType;
  started_at: string;
  ended_at?: string;
  total_messages: number;
  sentiment_score?: number;
  was_helpful?: boolean;
}

export interface AIMessage {
  message_id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tokens_used?: number;
}

// ── Hospital Admin Types ────────────────────────────────────

export type AdminRole = 'super_admin' | 'admin' | 'staff';

export interface HospitalAdmin {
  admin_id: string;
  hospital_id: string;
  email: string;
  full_name: string;
  role: AdminRole;
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

// ── API Types ───────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface HospitalSearchParams {
  latitude: number;
  longitude: number;
  radius_miles?: number;
  specialty_id?: string;
  available_now?: boolean;
  emergency_only?: boolean;
  page?: number;
  limit?: number;
}

// ── WebSocket Event Types ───────────────────────────────────

export interface WSSpecialistUpdate {
  specialist_id: string;
  hospital_id: string;
  availability_status: AvailabilityStatus;
  next_available_slot?: string;
}

export interface WSEmergencyAlert {
  alert_id: string;
  user_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  location: LocationCoordinates;
  timestamp: string;
}

export interface WSHealthMetricUpdate {
  user_id: string;
  metric_type: MetricType;
  value: number;
  is_anomaly: boolean;
  timestamp: string;
}
