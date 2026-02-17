// ============================================================
// HealthGuard Mobile - OTP Verification Screen
// ============================================================
// 6-digit OTP input with auto-advance, resend countdown,
// and elderly-friendly large digit boxes.
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Button from '../../components/common/Button';
import { useAuthStore } from '../../store/authStore';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';
import type { AuthStackParamList } from '../../navigation/AppNavigator';

// ── Types ─────────────────────────────────────────────────────

type OTPScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'OTP'>;
type OTPScreenRouteProp = RouteProp<AuthStackParamList, 'OTP'>;

interface OTPScreenProps {
  navigation: OTPScreenNavigationProp;
  route: OTPScreenRouteProp;
}

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN_SECONDS = 60;

// ── Component ─────────────────────────────────────────────────

const OTPScreen: React.FC<OTPScreenProps> = ({ navigation, route }) => {
  const { sessionId, phoneNumber } = route.params;
  const { verifyOTP, requestOTP, isLoading, error, clearError } = useAuthStore();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const [resendCountdown, setResendCountdown] = useState(RESEND_COUNTDOWN_SECONDS);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setTimeout(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleDigitChange = useCallback(
    (text: string, index: number) => {
      clearError();

      // Only allow single digit
      const digit = text.replace(/\D/g, '').slice(-1);

      const newDigits = [...digits];
      newDigits[index] = digit;
      setDigits(newDigits);

      // Auto-advance to next input
      if (digit && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits, clearError],
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      // Handle backspace: move to previous input
      if (key === 'Backspace' && !digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits],
  );

  const handleVerify = useCallback(async () => {
    const otp = digits.join('');
    if (otp.length !== OTP_LENGTH) {
      Alert.alert(
        'Incomplete Code',
        'Please enter all 6 digits of the verification code.',
        [{ text: 'OK' }],
      );
      return;
    }

    try {
      await verifyOTP(phoneNumber, otp, currentSessionId);
      // On success, the auth store sets isAuthenticated = true,
      // which automatically switches navigation to the main tabs.
    } catch {
      // Error is displayed from the store
    }
  }, [digits, verifyOTP, phoneNumber, currentSessionId]);

  const handleResend = useCallback(async () => {
    if (!canResend) return;

    try {
      clearError();
      const newSessionId = await requestOTP(phoneNumber);
      setCurrentSessionId(newSessionId);
      setDigits(Array(OTP_LENGTH).fill(''));
      setResendCountdown(RESEND_COUNTDOWN_SECONDS);
      setCanResend(false);
      inputRefs.current[0]?.focus();

      Alert.alert(
        'Code Sent',
        'A new verification code has been sent to your phone.',
        [{ text: 'OK' }],
      );
    } catch {
      // Error is set in the store
    }
  }, [canResend, clearError, requestOTP, phoneNumber]);

  const isCodeComplete = digits.every((d) => d !== '');

  // Format the phone number for display
  const displayPhone = phoneNumber.replace(
    /^\+1(\d{3})(\d{3})(\d{4})$/,
    '+1 ($1) $2-$3',
  );

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
          {/* Back button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Icon name="chevron-left" size={36} color={colors.textPrimary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.headerContainer}>
            <View style={styles.iconCircle}>
              <Icon name="shield-lock" size={48} color={colors.white} />
            </View>
            <Text style={styles.title}>Verification Code</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to
            </Text>
            <Text style={styles.phoneDisplay}>{displayPhone}</Text>
          </View>

          {/* OTP Input Boxes */}
          <View style={styles.otpContainer}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.otpInput,
                  digit ? styles.otpInputFilled : null,
                  error ? styles.otpInputError : null,
                ]}
                value={digit}
                onChangeText={(text) => handleDigitChange(text, index)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, index)
                }
                keyboardType="number-pad"
                maxLength={1}
                textContentType="oneTimeCode"
                autoComplete={index === 0 ? 'sms-otp' : 'off'}
                selectTextOnFocus
                accessibilityLabel={`Digit ${index + 1} of ${OTP_LENGTH}`}
                accessibilityHint="Enter a single digit"
              />
            ))}
          </View>

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <Icon name="alert-circle" size={24} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Verify Button */}
          <View style={styles.buttonContainer}>
            <Button
              title="Verify"
              onPress={handleVerify}
              variant="primary"
              size="large"
              fullWidth
              loading={isLoading}
              disabled={!isCodeComplete}
              icon="check-circle"
              accessibilityLabel="Verify code"
              accessibilityHint="Verifies the entered code and signs you in"
            />
          </View>

          {/* Resend Code */}
          <View style={styles.resendContainer}>
            {canResend ? (
              <TouchableOpacity
                onPress={handleResend}
                style={styles.resendButton}
                accessibilityRole="button"
                accessibilityLabel="Resend verification code"
              >
                <Icon name="refresh" size={24} color={colors.secondary} />
                <Text style={styles.resendActiveText}>Resend Code</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.resendTimerRow}>
                <Text style={styles.resendTimerText}>
                  Resend code in{' '}
                </Text>
                <Text style={styles.resendCountdownText}>
                  {resendCountdown}s
                </Text>
              </View>
            )}
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
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    minHeight: 48,
  },
  backText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    marginLeft: -4,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.heading1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyLarge,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  phoneDisplay: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: spacing.xl,
  },
  otpInput: {
    width: 56,
    height: 64,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    ...shadows.sm,
  },
  otpInputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  otpInputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
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
    marginBottom: spacing.xl,
  },
  resendContainer: {
    alignItems: 'center',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  resendActiveText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.secondary,
    marginLeft: spacing.sm,
  },
  resendTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendTimerText: {
    fontSize: typography.fontSize.base,
    color: colors.textTertiary,
  },
  resendCountdownText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
});

export default OTPScreen;
