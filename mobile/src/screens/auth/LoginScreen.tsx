// ============================================================
// HealthGuard Mobile - Login Screen
// ============================================================
// Phone number input for OTP authentication.
// Elderly-friendly with large text, inputs, and buttons.
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Button from '../../components/common/Button';
import { useAuthStore } from '../../store/authStore';
import { colors, typography, spacing, borderRadius, shadows, layout } from '../../theme';
import type { AuthStackParamList } from '../../navigation/AppNavigator';

// ── Types ─────────────────────────────────────────────────────

type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

// ── Component ─────────────────────────────────────────────────

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const { requestOTP, isLoading, error, clearError } = useAuthStore();

  const formatPhoneNumber = useCallback((text: string) => {
    // Remove all non-digit characters
    const digits = text.replace(/\D/g, '');

    // Limit to 10 digits
    const trimmed = digits.slice(0, 10);

    // Format as (XXX) XXX-XXXX
    if (trimmed.length <= 3) {
      return trimmed;
    } else if (trimmed.length <= 6) {
      return `(${trimmed.slice(0, 3)}) ${trimmed.slice(3)}`;
    } else {
      return `(${trimmed.slice(0, 3)}) ${trimmed.slice(3, 6)}-${trimmed.slice(6)}`;
    }
  }, []);

  const handlePhoneChange = useCallback(
    (text: string) => {
      clearError();
      setPhoneNumber(formatPhoneNumber(text));
    },
    [clearError, formatPhoneNumber],
  );

  const getRawPhoneNumber = useCallback(() => {
    return phoneNumber.replace(/\D/g, '');
  }, [phoneNumber]);

  const isPhoneValid = getRawPhoneNumber().length === 10;

  const handleSendCode = useCallback(async () => {
    if (!isPhoneValid) {
      Alert.alert(
        'Invalid Phone Number',
        'Please enter a valid 10-digit phone number.',
        [{ text: 'OK' }],
      );
      return;
    }

    try {
      const fullNumber = `+1${getRawPhoneNumber()}`;
      const sessionId = await requestOTP(fullNumber);
      navigation.navigate('OTP', {
        sessionId,
        phoneNumber: fullNumber,
      });
    } catch {
      // Error is already set in the store
    }
  }, [isPhoneValid, getRawPhoneNumber, requestOTP, navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / Branding */}
          <View style={styles.brandingContainer}>
            <View style={styles.logoCircle}>
              <Icon name="shield-check" size={64} color={colors.white} />
            </View>
            <Text style={styles.appName}>HealthGuard</Text>
            <Text style={styles.tagline}>Your Health, Protected</Text>
          </View>

          {/* Welcome Text */}
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>Welcome to HealthGuard</Text>
            <Text style={styles.welcomeSubtitle}>
              Enter your phone number to continue
            </Text>
          </View>

          {/* Phone Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <View style={styles.phoneInputRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>+1</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                placeholder="(555) 123-4567"
                placeholderTextColor={colors.placeholder}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                maxLength={14}
                autoFocus
                accessibilityLabel="Phone number input"
                accessibilityHint="Enter your 10-digit phone number"
              />
            </View>
          </View>

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <Icon name="alert-circle" size={24} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Send Code Button */}
          <View style={styles.buttonContainer}>
            <Button
              title="Send Verification Code"
              onPress={handleSendCode}
              variant="primary"
              size="large"
              fullWidth
              loading={isLoading}
              disabled={!isPhoneValid}
              icon="message-text"
              accessibilityLabel="Send verification code"
              accessibilityHint="Sends a 6-digit code to your phone number"
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    marginBottom: spacing.lg,
  },
  appName: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: typography.fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  welcomeContainer: {
    marginBottom: spacing['2xl'],
  },
  welcomeTitle: {
    ...typography.heading2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  welcomeSubtitle: {
    ...typography.bodyLarge,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCode: {
    height: layout.inputHeight,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRightWidth: 0,
    borderTopLeftRadius: borderRadius.md,
    borderBottomLeftRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    height: layout.inputHeight,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderLeftWidth: 1,
    borderTopRightRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    padding: spacing.base,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.danger,
    marginLeft: spacing.sm,
    flex: 1,
  },
  buttonContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.lg,
  },
  footerText: {
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default LoginScreen;
