// ============================================================
// HealthGuard Mobile - Screen Header Component
// ============================================================

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, typography, spacing, touchTargets, layout } from '../../theme';

// ── Types ─────────────────────────────────────────────────────

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBackPress?: () => void;
  rightIcon?: string;
  onRightPress?: () => void;
  rightLabel?: string;
  backgroundColor?: string;
  textColor?: string;
  subtitle?: string;
}

// ── Component ─────────────────────────────────────────────────

const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBackPress,
  rightIcon,
  onRightPress,
  rightLabel,
  backgroundColor = colors.white,
  textColor = colors.textPrimary,
  subtitle,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          paddingTop: Platform.OS === 'ios' ? insets.top : StatusBar.currentHeight || 0,
        },
      ]}
    >
      <StatusBar
        barStyle={backgroundColor === colors.white ? 'dark-content' : 'light-content'}
        backgroundColor={backgroundColor}
      />

      <View style={styles.content}>
        {/* Back Button */}
        <View style={styles.leftContainer}>
          {showBack && (
            <TouchableOpacity
              onPress={onBackPress}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              accessibilityHint="Navigates to the previous screen"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon name="chevron-left" size={36} color={textColor} />
              <Text style={[styles.backLabel, { color: textColor }]}>Back</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text
            style={[styles.title, { color: textColor }]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[styles.subtitle, { color: textColor }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right Action */}
        <View style={styles.rightContainer}>
          {rightIcon && (
            <TouchableOpacity
              onPress={onRightPress}
              style={styles.rightButton}
              accessibilityRole="button"
              accessibilityLabel={rightLabel || 'Action'}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon name={rightIcon} size={28} color={textColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  content: {
    height: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
  },
  leftContainer: {
    width: 100,
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightContainer: {
    width: 100,
    alignItems: 'flex-end',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
  },
  backLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginLeft: -4,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    marginTop: 2,
    opacity: 0.7,
  },
  rightButton: {
    minWidth: touchTargets.minimum,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Header;
