import { Request, Response, NextFunction } from 'express';

type ValidationRule = {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  message?: string;
  in?: readonly unknown[];
};

type ValidationSource = 'body' | 'query' | 'params';

/**
 * Generic validation middleware factory.
 * Accepts an array of validation rules and a source (body, query, params).
 */
export function validate(rules: ValidationRule[], source: ValidationSource = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];
    const data = req[source] as Record<string, unknown>;

    for (const rule of rules) {
      const value = data[rule.field];

      // Required check
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(rule.message || `${rule.field} is required.`);
        continue;
      }

      // Skip further checks if value is not present and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type check
      if (rule.type) {
        if (rule.type === 'array' && !Array.isArray(value)) {
          errors.push(rule.message || `${rule.field} must be an array.`);
          continue;
        } else if (rule.type === 'number') {
          const numVal = source === 'query' ? Number(value) : value;
          if (typeof numVal !== 'number' || isNaN(numVal as number)) {
            errors.push(rule.message || `${rule.field} must be a number.`);
            continue;
          }
        } else if (rule.type !== 'array' && typeof value !== rule.type) {
          errors.push(rule.message || `${rule.field} must be of type ${rule.type}.`);
          continue;
        }
      }

      // Number range checks
      if (rule.min !== undefined) {
        const numVal = typeof value === 'string' ? Number(value) : value;
        if (typeof numVal === 'number' && numVal < rule.min) {
          errors.push(rule.message || `${rule.field} must be at least ${rule.min}.`);
        }
      }

      if (rule.max !== undefined) {
        const numVal = typeof value === 'string' ? Number(value) : value;
        if (typeof numVal === 'number' && numVal > rule.max) {
          errors.push(rule.message || `${rule.field} must be at most ${rule.max}.`);
        }
      }

      // String length checks
      if (rule.minLength !== undefined && typeof value === 'string' && value.length < rule.minLength) {
        errors.push(rule.message || `${rule.field} must be at least ${rule.minLength} characters.`);
      }

      if (rule.maxLength !== undefined && typeof value === 'string' && value.length > rule.maxLength) {
        errors.push(rule.message || `${rule.field} must be at most ${rule.maxLength} characters.`);
      }

      // Pattern check
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        errors.push(rule.message || `${rule.field} has an invalid format.`);
      }

      // Enum check
      if (rule.in && !rule.in.includes(value)) {
        errors.push(rule.message || `${rule.field} must be one of: ${rule.in.join(', ')}.`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed.',
        details: errors,
      });
      return;
    }

    next();
  };
}

// ── Pre-built Validators ────────────────────────────────────

export const validateRegistration = validate([
  { field: 'phone_number', required: true, type: 'string', pattern: /^\+?[1-9]\d{1,14}$/, message: 'Valid phone number is required (E.164 format).' },
  { field: 'full_name', required: true, type: 'string', minLength: 2, maxLength: 100 },
  { field: 'email', type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format.' },
  { field: 'date_of_birth', type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, message: 'Date of birth must be in YYYY-MM-DD format.' },
  { field: 'blood_type', type: 'string', in: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const },
]);

export const validateLogin = validate([
  { field: 'phone_number', required: true, type: 'string', pattern: /^\+?[1-9]\d{1,14}$/, message: 'Valid phone number is required.' },
  { field: 'otp', required: true, type: 'string', minLength: 4, maxLength: 8 },
]);

export const validateAdminLogin = validate([
  { field: 'email', required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Valid email is required.' },
  { field: 'password', required: true, type: 'string', minLength: 8 },
]);

export const validateHospitalSearch = validate([
  { field: 'latitude', required: true, type: 'number', min: -90, max: 90, message: 'Latitude must be between -90 and 90.' },
  { field: 'longitude', required: true, type: 'number', min: -180, max: 180, message: 'Longitude must be between -180 and 180.' },
  { field: 'radius_miles', type: 'number', min: 1, max: 200, message: 'Radius must be between 1 and 200 miles.' },
  { field: 'limit', type: 'number', min: 1, max: 100 },
  { field: 'page', type: 'number', min: 1 },
], 'query');

export const validateHealthMetric = validate([
  { field: 'metric_type', required: true, type: 'string', in: ['heart_rate', 'blood_pressure', 'spo2', 'temperature', 'steps'] as const },
  { field: 'value', required: true, type: 'number', min: 0 },
  { field: 'unit', required: true, type: 'string' },
  { field: 'recorded_at', required: true, type: 'string' },
]);

export const validateVisitCreation = validate([
  { field: 'hospital_id', required: true, type: 'string' },
  { field: 'visit_type', required: true, type: 'string', in: ['emergency', 'scheduled', 'walk_in'] as const },
  { field: 'visit_date', required: true, type: 'string' },
]);

export const validateFeedback = validate([
  { field: 'rating', required: true, type: 'number', min: 1, max: 5, message: 'Rating must be between 1 and 5.' },
  { field: 'wait_time_rating', required: true, type: 'number', min: 1, max: 5 },
  { field: 'staff_rating', required: true, type: 'number', min: 1, max: 5 },
  { field: 'facility_rating', required: true, type: 'number', min: 1, max: 5 },
  { field: 'would_recommend', required: true, type: 'boolean' },
  { field: 'comments', type: 'string', maxLength: 2000 },
]);

export const validateAIMessage = validate([
  { field: 'content', required: true, type: 'string', minLength: 1, maxLength: 5000 },
]);

export const validateAIConversation = validate([
  { field: 'conversation_type', required: true, type: 'string', in: ['emergency_guidance', 'triage', 'general_health'] as const },
  { field: 'initial_message', required: true, type: 'string', minLength: 1, maxLength: 5000 },
]);

export const validateEmergencyAlert = validate([
  { field: 'alert_type', required: true, type: 'string', in: ['low_heart_rate', 'high_heart_rate', 'fall_detected', 'irregular_rhythm', 'low_spo2'] as const },
  { field: 'severity', required: true, type: 'string', in: ['critical', 'high', 'medium', 'low'] as const },
  { field: 'location_lat', type: 'number', min: -90, max: 90 },
  { field: 'location_lng', type: 'number', min: -180, max: 180 },
]);

export const validateSpecialistStatus = validate([
  { field: 'availability_status', required: true, type: 'string', in: ['available', 'busy', 'off_duty'] as const },
]);
