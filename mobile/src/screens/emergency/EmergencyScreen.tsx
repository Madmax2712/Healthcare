// ============================================================
// HealthGuard Mobile - Emergency SOS Screen
// ============================================================
// Large SOS button with press-and-hold activation, 911 calling,
// contact notification, location sharing, and alert history.
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  Vibration,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useEmergencyStore } from '../../store/emergencyStore';
import { emergencyService } from '../../services/emergencyService';
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  touchTargets,
} from '../../theme';

// ── Constants ─────────────────────────────────────────────────

const SOS_HOLD_DURATION_MS = 3000;
const PULSE_INTERVAL_MS = 1000;

// ── Alert History Item Sub-Component ──────────────────────────

interface AlertHistoryItemProps {
  type: string;
  severity: string;
  status: string;
  time: string;
}

const AlertHistoryItem: React.FC<AlertHistoryItemProps> = ({
  type,
  severity,
  status,
  time,
}) => {
  const typeLabels: Record<string, string> = {
    low_heart_rate: 'Low Heart Rate',
    high_heart_rate: 'High Heart Rate',
    fall_detected: 'Fall Detected',
    irregular_rhythm: 'Irregular Rhythm',
    low_spo2: 'Low SpO2',
  };

  const statusColors: Record<string, string> = {
    active: colors.danger,
    acknowledged: colors.warning,
    resolved: colors.success,
    false_alarm: colors.textTertiary,
  };

  return (
    <View style={styles.historyItem}>
      <View
        style={[
          styles.historyDot,
          { backgroundColor: statusColors[status] || colors.textTertiary },
        ]}
      />
      <View style={styles.historyContent}>
        <Text style={styles.historyType}>
          {typeLabels[type] || type}
        </Text>
        <Text style={styles.historyMeta}>
          {severity.charAt(0).toUpperCase() + severity.slice(1)} | {status.replace('_', ' ')}
        </Text>
      </View>
      <Text style={styles.historyTime}>{time}</Text>
    </View>
  );
};

// ── Main Component ────────────────────────────────────────────

const EmergencyScreen: React.FC = () => {
  const {
    isEmergencyActive,
    currentAlert,
    activeAlerts,
    alertHistory,
    isLoading,
    fetchActiveAlerts,
    fetchAlertHistory,
  } = useEmergencyStore();

  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartRef = useRef<number>(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Fetch data on mount
  useEffect(() => {
    fetchActiveAlerts();
    fetchAlertHistory();
  }, [fetchActiveAlerts, fetchAlertHistory]);

  // Pulse animation for SOS button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: PULSE_INTERVAL_MS,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: PULSE_INTERVAL_MS,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Flash animation when emergency is active
  useEffect(() => {
    if (isEmergencyActive) {
      const flash = Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, {
            toValue: 0.15,
            duration: 500,
            useNativeDriver: false,
          }),
          Animated.timing(flashAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false,
          }),
        ]),
      );
      flash.start();
      return () => flash.stop();
    } else {
      flashAnim.setValue(0);
    }
  }, [isEmergencyActive, flashAnim]);

  const startHold = useCallback(() => {
    if (isEmergencyActive || isTriggering) return;

    setIsHolding(true);
    holdStartRef.current = Date.now();
    Vibration.vibrate(100);

    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(elapsed / SOS_HOLD_DURATION_MS, 1);
      setHoldProgress(progress);

      if (progress >= 1) {
        // Trigger emergency
        if (holdTimerRef.current) {
          clearInterval(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        setIsHolding(false);
        triggerEmergency();
      }
    }, 50);
  }, [isEmergencyActive, isTriggering]);

  const endHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  }, []);

  const triggerEmergency = useCallback(async () => {
    setIsTriggering(true);
    try {
      await emergencyService.triggerEmergencyAlert('high_heart_rate', 'critical');
    } catch {
      Alert.alert(
        'Alert Failed',
        'Failed to create emergency alert. Please call 911 directly.',
        [
          {
            text: 'Call 911',
            onPress: () => emergencyService.callEmergencyServices(),
          },
          { text: 'OK' },
        ],
      );
    } finally {
      setIsTriggering(false);
    }
  }, []);

  const handleCall911 = useCallback(() => {
    emergencyService.callEmergencyServices();
  }, []);

  const handleNotifyContacts = useCallback(async () => {
    if (!currentAlert) return;
    try {
      await useEmergencyStore.getState().notifyContacts(currentAlert.alert_id);
      Alert.alert(
        'Contacts Notified',
        'Your emergency contacts have been notified.',
        [{ text: 'OK' }],
      );
    } catch {
      Alert.alert('Notification Failed', 'Could not notify all contacts.');
    }
  }, [currentAlert]);

  const handleShareLocation = useCallback(async () => {
    try {
      await emergencyService.shareLocationWithContacts();
    } catch {
      Alert.alert('Location Share Failed', 'Could not share your location.');
    }
  }, []);

  const handleCancelEmergency = useCallback(() => {
    if (!currentAlert) return;

    Alert.alert(
      'Cancel Emergency?',
      'Are you sure you want to cancel this emergency alert? Select the reason:',
      [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'False Alarm',
          onPress: async () => {
            await emergencyService.resolveEmergency(currentAlert.alert_id, true);
          },
        },
        {
          text: 'Resolved',
          onPress: async () => {
            await emergencyService.resolveEmergency(currentAlert.alert_id, false);
          },
        },
      ],
    );
  }, [currentAlert]);

  const flashBackgroundColor = flashAnim.interpolate({
    inputRange: [0, 0.15],
    outputRange: ['transparent', colors.dangerLight],
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Animated.View
        style={[styles.flashOverlay, { backgroundColor: flashBackgroundColor }]}
      />

      {/* Header */}
      <View style={styles.header}>
        <Icon name="alert-octagon" size={28} color={colors.danger} />
        <Text style={styles.headerTitle}>Emergency SOS</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Emergency State */}
        {isEmergencyActive && currentAlert ? (
          <View style={styles.activeEmergencyContainer}>
            <Card
              style={styles.alertActiveCard}
              variant="colored"
              backgroundColor={colors.dangerLight}
              padding="large"
            >
              <View style={styles.alertActiveHeader}>
                <Icon name="alert-circle" size={40} color={colors.danger} />
                <Text style={styles.alertActiveTitle}>
                  Emergency Alert Active
                </Text>
              </View>
              <Text style={styles.alertActiveDetail}>
                Type: {currentAlert.alert_type.replace(/_/g, ' ')}
              </Text>
              <Text style={styles.alertActiveDetail}>
                Severity: {currentAlert.severity}
              </Text>
              {currentAlert.location_address && (
                <Text style={styles.alertActiveDetail}>
                  Location: {currentAlert.location_address}
                </Text>
              )}
            </Card>

            {/* Emergency Action Buttons */}
            <View style={styles.emergencyActions}>
              <Button
                title="Call 911"
                onPress={handleCall911}
                variant="danger"
                size="large"
                fullWidth
                icon="phone"
                accessibilityLabel="Call 911 emergency services"
              />
              <Button
                title="Notify Emergency Contacts"
                onPress={handleNotifyContacts}
                variant="primary"
                size="large"
                fullWidth
                icon="account-alert"
                accessibilityLabel="Notify your emergency contacts"
              />
              <Button
                title="Share Location"
                onPress={handleShareLocation}
                variant="secondary"
                size="large"
                fullWidth
                icon="map-marker-radius"
                accessibilityLabel="Share your current location"
              />
              <Button
                title="Cancel / False Alarm"
                onPress={handleCancelEmergency}
                variant="outline"
                size="large"
                fullWidth
                icon="close-circle"
                accessibilityLabel="Cancel emergency alert"
              />
            </View>
          </View>
        ) : (
          /* SOS Button State */
          <View style={styles.sosSectionContainer}>
            <Animated.View
              style={[
                styles.sosOuterRing,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <TouchableOpacity
                onPressIn={startHold}
                onPressOut={endHold}
                activeOpacity={0.8}
                style={styles.sosButton}
                disabled={isTriggering}
                accessibilityRole="button"
                accessibilityLabel="Emergency SOS button"
                accessibilityHint="Press and hold for 3 seconds to trigger emergency alert"
              >
                {/* Progress ring */}
                {isHolding && (
                  <View style={styles.progressRing}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          height: `${holdProgress * 100}%`,
                        },
                      ]}
                    />
                  </View>
                )}
                {isTriggering ? (
                  <LoadingSpinner size="large" color={colors.white} />
                ) : (
                  <>
                    <Icon name="alert-octagon" size={56} color={colors.white} />
                    <Text style={styles.sosText}>SOS</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            <Text style={styles.sosInstruction}>
              {isHolding
                ? `Hold for ${Math.max(0, Math.ceil((SOS_HOLD_DURATION_MS - holdProgress * SOS_HOLD_DURATION_MS) / 1000))} more seconds...`
                : 'Press and hold for 3 seconds\nto trigger emergency alert'}
            </Text>

            {/* Quick Call 911 */}
            <View style={styles.quickCallContainer}>
              <Button
                title="Call 911 Now"
                onPress={handleCall911}
                variant="danger"
                size="large"
                fullWidth
                icon="phone"
                accessibilityLabel="Call 911 immediately"
              />
            </View>
          </View>
        )}

        {/* Alert History */}
        {alertHistory.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Alert History</Text>
            <Card style={styles.historyCard} variant="outlined">
              {alertHistory.slice(0, 10).map((alert) => (
                <AlertHistoryItem
                  key={alert.alert_id}
                  type={alert.alert_type}
                  severity={alert.severity}
                  status={alert.alert_status}
                  time={getTimeSince(alert.created_at)}
                />
              ))}
            </Card>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Helper ────────────────────────────────────────────────────

function getTimeSince(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.base,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.danger,
    marginLeft: spacing.md,
  },
  scrollView: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
  },

  // SOS Button Section
  sosSectionContainer: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  sosOuterRing: {
    width: touchTargets.sosButton + 40,
    height: touchTargets.sosButton + 40,
    borderRadius: (touchTargets.sosButton + 40) / 2,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  sosButton: {
    width: touchTargets.sosButton,
    height: touchTargets.sosButton,
    borderRadius: touchTargets.sosButton / 2,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.xl,
    overflow: 'hidden',
  },
  progressRing: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  progressFill: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  sosText: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.white,
    marginTop: spacing.xs,
  },
  sosInstruction: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: spacing.xl,
  },
  quickCallContainer: {
    width: '100%',
    paddingHorizontal: spacing.lg,
  },

  // Active Emergency
  activeEmergencyContainer: {
    marginBottom: spacing.xl,
  },
  alertActiveCard: {
    marginBottom: spacing.lg,
  },
  alertActiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  alertActiveTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.danger,
    marginLeft: spacing.md,
  },
  alertActiveDetail: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginLeft: spacing['4xl'] + spacing.md,
  },
  emergencyActions: {
    gap: spacing.md,
  },

  // History
  sectionTitle: {
    ...typography.heading3,
    marginBottom: spacing.base,
  },
  historyCard: {
    marginBottom: spacing.xl,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.md,
  },
  historyContent: {
    flex: 1,
  },
  historyType: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  historyMeta: {
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    marginTop: 2,
  },
  historyTime: {
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});

export default EmergencyScreen;
