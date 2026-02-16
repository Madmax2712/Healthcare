// ============================================================
// HealthGuard Platform - Shared Constants
// ============================================================

// ── Health Thresholds ───────────────────────────────────────

export const HEART_RATE_THRESHOLDS = {
  CRITICAL_LOW: 40,
  LOW: 50,
  NORMAL_LOW: 60,
  NORMAL_HIGH: 100,
  HIGH: 120,
  CRITICAL_HIGH: 150,
} as const;

export const SPO2_THRESHOLDS = {
  CRITICAL_LOW: 90,
  LOW: 94,
  NORMAL: 95,
} as const;

// ── Alert Configuration ─────────────────────────────────────

export const ALERT_SEVERITY_MAP: Record<string, { min?: number; max?: number; severity: string }[]> = {
  heart_rate: [
    { max: 40, severity: 'critical' },
    { min: 40, max: 50, severity: 'high' },
    { min: 50, max: 60, severity: 'medium' },
    { min: 100, max: 120, severity: 'medium' },
    { min: 120, max: 150, severity: 'high' },
    { min: 150, severity: 'critical' },
  ],
  spo2: [
    { max: 90, severity: 'critical' },
    { min: 90, max: 94, severity: 'high' },
    { min: 94, max: 95, severity: 'medium' },
  ],
};

// ── Search Defaults ─────────────────────────────────────────

export const DEFAULT_SEARCH_RADIUS_MILES = 25;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ── WebSocket Events ────────────────────────────────────────

export const WS_EVENTS = {
  // Client → Server
  JOIN_HOSPITAL_ROOM: 'join:hospital',
  LEAVE_HOSPITAL_ROOM: 'leave:hospital',
  JOIN_USER_ROOM: 'join:user',
  HEALTH_METRIC_UPDATE: 'health:metric:update',

  // Server → Client
  SPECIALIST_STATUS_CHANGED: 'specialist:status:changed',
  EMERGENCY_ALERT_CREATED: 'emergency:alert:created',
  EMERGENCY_ALERT_RESOLVED: 'emergency:alert:resolved',
  HEALTH_ANOMALY_DETECTED: 'health:anomaly:detected',
  HOSPITAL_DATA_UPDATED: 'hospital:data:updated',
} as const;

// ── API Endpoints ───────────────────────────────────────────

export const API_VERSION = 'v1';
export const API_BASE_PATH = `/api/${API_VERSION}`;

// ── Medical Specialties ─────────────────────────────────────

export const DEFAULT_SPECIALTIES = [
  { code: 'CARD', name: 'Cardiology', is_emergency: true, order: 1 },
  { code: 'NEUR', name: 'Neurology', is_emergency: true, order: 2 },
  { code: 'ORTH', name: 'Orthopedics', is_emergency: true, order: 3 },
  { code: 'PEDI', name: 'Pediatrics', is_emergency: true, order: 4 },
  { code: 'EMED', name: 'Emergency Medicine', is_emergency: true, order: 5 },
  { code: 'SURG', name: 'General Surgery', is_emergency: true, order: 6 },
  { code: 'INMD', name: 'Internal Medicine', is_emergency: false, order: 7 },
  { code: 'OBGN', name: 'Obstetrics & Gynecology', is_emergency: true, order: 8 },
  { code: 'DERM', name: 'Dermatology', is_emergency: false, order: 9 },
  { code: 'OPTH', name: 'Ophthalmology', is_emergency: false, order: 10 },
  { code: 'ENT', name: 'Ear, Nose & Throat', is_emergency: false, order: 11 },
  { code: 'UROL', name: 'Urology', is_emergency: false, order: 12 },
  { code: 'PSYC', name: 'Psychiatry', is_emergency: false, order: 13 },
  { code: 'PULM', name: 'Pulmonology', is_emergency: true, order: 14 },
  { code: 'GAST', name: 'Gastroenterology', is_emergency: false, order: 15 },
  { code: 'ONCO', name: 'Oncology', is_emergency: false, order: 16 },
  { code: 'NEPH', name: 'Nephrology', is_emergency: false, order: 17 },
  { code: 'RHEU', name: 'Rheumatology', is_emergency: false, order: 18 },
  { code: 'ENDO', name: 'Endocrinology', is_emergency: false, order: 19 },
  { code: 'RADI', name: 'Radiology', is_emergency: false, order: 20 },
] as const;

// ── Feedback Prompts ────────────────────────────────────────

export const FEEDBACK_DELAY_HOURS = 2; // Hours after visit to prompt feedback
export const FEEDBACK_REMINDER_DAYS = 1; // Days to wait before reminder

// ── Privacy & Compliance ────────────────────────────────────

export const DATA_RETENTION_DAYS = 2555; // ~7 years per HIPAA
export const ANONYMIZATION_SALT_ROTATION_DAYS = 90;
