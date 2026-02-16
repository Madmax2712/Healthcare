// ============================================================
// HealthGuard Mobile - Card Component
// ============================================================

import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../../theme';

// ── Types ─────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined' | 'colored';
  backgroundColor?: string;
  padding?: 'default' | 'large' | 'compact' | 'none';
  accessibilityLabel?: string;
}

// ── Component ─────────────────────────────────────────────────

const Card: React.FC<CardProps> = ({
  children,
  onPress,
  style,
  variant = 'default',
  backgroundColor,
  padding = 'default',
  accessibilityLabel,
}) => {
  const cardStyles: ViewStyle[] = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`padding_${padding}`],
    backgroundColor ? { backgroundColor } : undefined,
    style,
  ].filter(Boolean) as ViewStyle[];

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={cardStyles}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyles} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },

  // Variants
  variant_default: {
    ...shadows.sm,
  },
  variant_elevated: {
    ...shadows.lg,
  },
  variant_outlined: {
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  variant_colored: {
    ...shadows.md,
  },

  // Padding options - generous for elderly users
  padding_default: {
    padding: spacing.lg,
  },
  padding_large: {
    padding: spacing.xl,
  },
  padding_compact: {
    padding: spacing.base,
  },
  padding_none: {
    padding: 0,
  },
});

export default Card;
