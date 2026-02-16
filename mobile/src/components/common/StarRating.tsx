// ============================================================
// HealthGuard Mobile - Star Rating Component
// ============================================================
// Large tappable stars for elderly-friendly feedback input.
// ============================================================

import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, typography, spacing, touchTargets } from '../../theme';

// ── Types ─────────────────────────────────────────────────────

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  maxStars?: number;
  starSize?: number;
  label?: string;
  readonly?: boolean;
  showValue?: boolean;
  activeColor?: string;
  inactiveColor?: string;
}

// ── Component ─────────────────────────────────────────────────

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  onRatingChange,
  maxStars = 5,
  starSize = 44,
  label,
  readonly = false,
  showValue = false,
  activeColor = colors.accent,
  inactiveColor = colors.borderLight,
}) => {
  const handleStarPress = (starIndex: number) => {
    if (readonly || !onRatingChange) return;
    onRatingChange(starIndex + 1);
  };

  const getRatingLabel = (value: number): string => {
    const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
    return labels[Math.min(value, 5)] || '';
  };

  return (
    <View
      style={styles.container}
      accessibilityRole="adjustable"
      accessibilityLabel={`${label || 'Rating'}: ${rating} out of ${maxStars} stars`}
      accessibilityValue={{
        min: 0,
        max: maxStars,
        now: rating,
        text: getRatingLabel(rating),
      }}
    >
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={styles.starsRow}>
        {Array.from({ length: maxStars }, (_, index) => {
          const isFilled = index < rating;
          const isHalf = index === Math.floor(rating) && rating % 1 !== 0;

          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleStarPress(index)}
              disabled={readonly}
              style={[
                styles.starButton,
                { minWidth: touchTargets.minimum, minHeight: touchTargets.minimum },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${index + 1} star${index !== 0 ? 's' : ''}`}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Icon
                name={
                  isFilled
                    ? 'star'
                    : isHalf
                      ? 'star-half-full'
                      : 'star-outline'
                }
                size={starSize}
                color={isFilled || isHalf ? activeColor : inactiveColor}
              />
            </TouchableOpacity>
          );
        })}

        {showValue && rating > 0 && (
          <Text style={styles.ratingValue}>
            {rating.toFixed(1)}
          </Text>
        )}
      </View>

      {!readonly && rating > 0 && (
        <Text style={styles.ratingLabel}>
          {getRatingLabel(rating)}
        </Text>
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  ratingValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginLeft: spacing.md,
  },
  ratingLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});

export default StarRating;
