// ============================================================
// HealthGuard Mobile - Elderly-Friendly Theme
// ============================================================
// Designed for accessibility with large fonts, high contrast,
// and large touch targets (minimum 48dp, preferred 56dp).
// ============================================================

import { Dimensions, TextStyle, ViewStyle } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Color Palette ─────────────────────────────────────────────
// High contrast colors that meet WCAG AA standards (4.5:1 ratio)

export const colors = {
  // Primary
  primary: '#0A2463',        // Deep navy blue
  primaryLight: '#1E4D8C',
  primaryDark: '#061539',

  // Secondary
  secondary: '#3E92CC',      // Bright blue
  secondaryLight: '#6BB0E0',
  secondaryDark: '#2A7AB5',

  // Accent
  accent: '#F18F01',         // Warm orange
  accentLight: '#FFB347',
  accentDark: '#D47A01',

  // Status colors
  success: '#2D8B46',        // Green - available/healthy
  successLight: '#E8F5E9',
  warning: '#E5A100',        // Amber - caution/busy
  warningLight: '#FFF8E1',
  danger: '#C62828',         // Red - critical/emergency
  dangerLight: '#FFEBEE',
  info: '#1565C0',           // Blue - informational
  infoLight: '#E3F2FD',

  // Heart rate status
  heartRateNormal: '#2D8B46',
  heartRateWarning: '#E5A100',
  heartRateCritical: '#C62828',

  // Hospital availability
  availableGreen: '#2D8B46',
  busyYellow: '#E5A100',
  unavailableRed: '#C62828',

  // Neutrals
  white: '#FFFFFF',
  background: '#F5F7FA',
  surface: '#FFFFFF',
  border: '#D1D5DB',
  borderLight: '#E5E7EB',
  disabled: '#9CA3AF',
  placeholder: '#9CA3AF',

  // Text (high contrast)
  textPrimary: '#111827',    // Near black for maximum readability
  textSecondary: '#374151',
  textTertiary: '#6B7280',
  textInverse: '#FFFFFF',
  textLink: '#1565C0',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
} as const;

// ── Typography ────────────────────────────────────────────────
// Large base font size (18pt) for elderly readability

export const typography = {
  // Font families
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },

  // Font sizes - all generous for elderly users
  fontSize: {
    xs: 14,
    sm: 16,
    base: 18,      // Base size is 18pt (larger than standard 14-16)
    lg: 20,
    xl: 24,
    '2xl': 28,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
    display: 64,   // For heart rate BPM display
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Font weights
  fontWeight: {
    regular: '400' as TextStyle['fontWeight'],
    medium: '500' as TextStyle['fontWeight'],
    semibold: '600' as TextStyle['fontWeight'],
    bold: '700' as TextStyle['fontWeight'],
    extrabold: '800' as TextStyle['fontWeight'],
  },

  // Pre-built text styles
  heading1: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    color: '#111827',
  } as TextStyle,

  heading2: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    color: '#111827',
  } as TextStyle,

  heading3: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    color: '#111827',
  } as TextStyle,

  body: {
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 28,
    color: '#111827',
  } as TextStyle,

  bodyLarge: {
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 30,
    color: '#111827',
  } as TextStyle,

  caption: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#6B7280',
  } as TextStyle,

  button: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  } as TextStyle,

  buttonSmall: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  } as TextStyle,
} as const;

// ── Spacing ───────────────────────────────────────────────────
// Generous spacing for comfortable tapping and reading

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 56,
  '6xl': 64,
  screenPadding: 20,
} as const;

// ── Touch Targets ─────────────────────────────────────────────
// Minimum touch target sizes per WCAG 2.1 / Apple HIG

export const touchTargets = {
  minimum: 48,     // WCAG minimum
  preferred: 56,   // Comfortable for elderly users
  large: 64,       // For important actions
  sosButton: 120,  // Extra large for SOS
} as const;

// ── Border Radius ─────────────────────────────────────────────

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

// ── Shadows / Elevation ───────────────────────────────────────

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  } as ViewStyle,

  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  } as ViewStyle,

  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  } as ViewStyle,

  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  } as ViewStyle,
} as const;

// ── Layout ────────────────────────────────────────────────────

export const layout = {
  screenWidth: SCREEN_WIDTH,
  maxContentWidth: 600,
  headerHeight: 72, // Larger header for elderly users
  tabBarHeight: 80, // Larger tab bar
  inputHeight: 56,  // Large input fields
} as const;

// ── Combined Theme Object ─────────────────────────────────────

const theme = {
  colors,
  typography,
  spacing,
  touchTargets,
  borderRadius,
  shadows,
  layout,
} as const;

export type Theme = typeof theme;

export default theme;
