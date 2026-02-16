// ============================================================
// HealthGuard Platform - Shared Utilities
// ============================================================

import { HEART_RATE_THRESHOLDS, SPO2_THRESHOLDS } from '../constants';

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
export function calculateDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Determine heart rate severity level
 */
export function getHeartRateSeverity(
  bpm: number
): 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high' {
  if (bpm <= HEART_RATE_THRESHOLDS.CRITICAL_LOW) return 'critical_low';
  if (bpm <= HEART_RATE_THRESHOLDS.LOW) return 'low';
  if (bpm >= HEART_RATE_THRESHOLDS.CRITICAL_HIGH) return 'critical_high';
  if (bpm >= HEART_RATE_THRESHOLDS.HIGH) return 'high';
  return 'normal';
}

/**
 * Determine SpO2 severity level
 */
export function getSpO2Severity(
  value: number
): 'normal' | 'low' | 'critical_low' {
  if (value <= SPO2_THRESHOLDS.CRITICAL_LOW) return 'critical_low';
  if (value <= SPO2_THRESHOLDS.LOW) return 'low';
  return 'normal';
}

/**
 * Check if a health metric value is anomalous
 */
export function isAnomalousMetric(
  metricType: string,
  value: number
): boolean {
  switch (metricType) {
    case 'heart_rate':
      return (
        value <= HEART_RATE_THRESHOLDS.LOW ||
        value >= HEART_RATE_THRESHOLDS.HIGH
      );
    case 'spo2':
      return value <= SPO2_THRESHOLDS.LOW;
    default:
      return false;
  }
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Generate anonymized user ID (one-way hash)
 */
export function anonymizeUserId(userId: string, salt: string): string {
  // Simple hash for demonstration - in production use crypto.createHash('sha256')
  let hash = 0;
  const str = userId + salt;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Format distance for display
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) return '< 0.1 mi';
  if (miles < 1) return `${(miles * 5280).toFixed(0)} ft`;
  return `${miles.toFixed(1)} mi`;
}

/**
 * Format time ago for display
 */
export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s()-]{10,15}$/;
  return phoneRegex.test(phone);
}

/**
 * Get day name from day number
 */
export function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || '';
}

/**
 * Format time for display (HH:mm → h:mm AM/PM)
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}
