// ============================================================
// HealthGuard Mobile - Accessible Button Component
// ============================================================
// Large, accessible button with haptic feedback support and
// minimum 56dp height for elderly-friendly interaction.
// ============================================================

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  Platform,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, typography, spacing, touchTargets, borderRadius, shadows } from '../../theme';

// ── Types ─────────────────────────────────────────────────────

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
  size?: 'default' | 'large' | 'small';
  icon?: string;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

// ── Component ─────────────────────────────────────────────────

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'default',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (isDisabled) return;
    // Haptic feedback on supported platforms
    if (Platform.OS === 'ios') {
      try {
        const ReactNativeHapticFeedback = require('react-native-haptic-feedback');
        ReactNativeHapticFeedback.trigger('impactMedium');
      } catch {
        // Haptic feedback not available
      }
    }
    onPress();
  };

  const buttonStyles: ViewStyle[] = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style,
  ].filter(Boolean) as ViewStyle[];

  const labelStyles: TextStyle[] = [
    styles.label,
    styles[`label_${variant}`],
    styles[`labelSize_${size}`],
    isDisabled && styles.labelDisabled,
    textStyle,
  ].filter(Boolean) as TextStyle[];

  const iconColor = variant === 'outline' || variant === 'ghost'
    ? colors.primary
    : colors.textInverse;

  const iconSize = size === 'large' ? 28 : size === 'small' ? 20 : 24;

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={buttonStyles}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.white}
          size="small"
        />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && (
            <Icon
              name={icon}
              size={iconSize}
              color={isDisabled ? colors.disabled : iconColor}
              style={styles.iconLeft}
            />
          )}
          <Text style={labelStyles}>{title}</Text>
          {icon && iconPosition === 'right' && (
            <Icon
              name={icon}
              size={iconSize}
              color={isDisabled ? colors.disabled : iconColor}
              style={styles.iconRight}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    minHeight: touchTargets.preferred,
    paddingHorizontal: spacing.xl,
    ...shadows.sm,
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Variants
  variant_primary: {
    backgroundColor: colors.primary,
  },
  variant_secondary: {
    backgroundColor: colors.secondary,
  },
  variant_outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
    shadowOpacity: 0,
    elevation: 0,
  },
  variant_danger: {
    backgroundColor: colors.danger,
  },
  variant_success: {
    backgroundColor: colors.success,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },

  // Sizes
  size_default: {
    minHeight: touchTargets.preferred,
    paddingHorizontal: spacing.xl,
  },
  size_large: {
    minHeight: touchTargets.large,
    paddingHorizontal: spacing['2xl'],
  },
  size_small: {
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.lg,
  },

  // Full width
  fullWidth: {
    width: '100%',
  },

  // Disabled
  disabled: {
    opacity: 0.5,
  },

  // Label
  label: {
    ...typography.button,
    textAlign: 'center',
  },
  label_primary: {
    color: colors.textInverse,
  },
  label_secondary: {
    color: colors.textInverse,
  },
  label_outline: {
    color: colors.primary,
  },
  label_danger: {
    color: colors.textInverse,
  },
  label_success: {
    color: colors.textInverse,
  },
  label_ghost: {
    color: colors.primary,
  },
  labelSize_default: {
    fontSize: typography.fontSize.lg,
  },
  labelSize_large: {
    fontSize: typography.fontSize.xl,
  },
  labelSize_small: {
    fontSize: typography.fontSize.base,
  },
  labelDisabled: {
    color: colors.disabled,
  },

  // Icons
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
});

export default Button;
