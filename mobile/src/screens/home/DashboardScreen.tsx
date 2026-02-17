// ============================================================
// HealthGuard Mobile - Dashboard Screen
// ============================================================
// Health dashboard with heart rate, vitals grid, anomalies,
// and quick actions. Pull-to-refresh support.
// ============================================================

import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useHealthStore } from '../../store/healthStore';
import { useAuthStore } from '../../store/authStore';
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  touchTargets,
} from '../../theme';

// ── Heart Rate Status Helpers ─────────────────────────────────

const getStatusConfig = (status: 'normal' | 'warning' | 'critical') => {
  switch (status) {
    case 'critical':
      return {
        label: 'Critical',
        color: colors.heartRateCritical,
        bgColor: colors.dangerLight,
        icon: 'alert-circle',
      };
    case 'warning':
      return {
        label: 'Warning',
        color: colors.heartRateWarning,
        bgColor: colors.warningLight,
        icon: 'alert',
      };
    default:
      return {
        label: 'Normal',
        color: colors.heartRateNormal,
        bgColor: colors.successLight,
        icon: 'check-circle',
      };
  }
};

// ── Vitals Card Sub-Component ─────────────────────────────────

interface VitalCardProps {
  icon: string;
  label: string;
  value: string;
  unit: string;
  color: string;
}

const VitalCard: React.FC<VitalCardProps> = ({ icon, label, value, unit, color }) => (
  <Card style={styles.vitalCard} variant="elevated">
    <View style={[styles.vitalIconCircle, { backgroundColor: color + '20' }]}>
      <Icon name={icon} size={28} color={color} />
    </View>
    <Text style={styles.vitalLabel}>{label}</Text>
    <View style={styles.vitalValueRow}>
      <Text style={styles.vitalValue}>{value}</Text>
      <Text style={styles.vitalUnit}>{unit}</Text>
    </View>
  </Card>
);

// ── Anomaly Item Sub-Component ────────────────────────────────

interface AnomalyItemProps {
  type: string;
  value: number;
  unit: string;
  time: string;
}

const AnomalyItem: React.FC<AnomalyItemProps> = ({ type, value, unit, time }) => {
  const typeLabels: Record<string, string> = {
    heart_rate: 'Heart Rate',
    spo2: 'SpO2',
    temperature: 'Temperature',
    blood_pressure: 'Blood Pressure',
    steps: 'Steps',
  };

  return (
    <View style={styles.anomalyItem}>
      <View style={styles.anomalyDot} />
      <View style={styles.anomalyContent}>
        <Text style={styles.anomalyType}>{typeLabels[type] || type}</Text>
        <Text style={styles.anomalyValue}>
          {value} {unit}
        </Text>
      </View>
      <Text style={styles.anomalyTime}>{time}</Text>
    </View>
  );
};

// ── Main Component ────────────────────────────────────────────

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);

  const {
    currentHeartRate,
    latestMetrics,
    anomalies,
    isLoading,
    getHeartRateStatus,
    fetchLatestMetrics,
    fetchAnomalies,
  } = useHealthStore();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [refreshing, setRefreshing] = React.useState(false);

  // Pulse animation for heart icon
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Load data on mount
  useEffect(() => {
    fetchLatestMetrics();
    fetchAnomalies();
  }, [fetchLatestMetrics, fetchAnomalies]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchLatestMetrics(), fetchAnomalies()]);
    setRefreshing(false);
  }, [fetchLatestMetrics, fetchAnomalies]);

  const heartRateStatus = getHeartRateStatus();
  const statusConfig = getStatusConfig(heartRateStatus);

  // Extract vitals from latest metrics
  const spo2 = latestMetrics.spo2;
  const temperature = latestMetrics.temperature;
  const steps = latestMetrics.steps;
  const bloodPressure = latestMetrics.blood_pressure;

  // Time since last heart rate update
  const heartRateMetric = latestMetrics.heart_rate;
  const lastUpdated = heartRateMetric
    ? getTimeSince(heartRateMetric.recorded_at)
    : 'No data';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>HealthGuard</Text>
          {user && (
            <Text style={styles.headerGreeting}>
              Hello, {user.full_name?.split(' ')[0] || 'there'}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Profile')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="cog" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Heart Rate Card */}
        <Card style={styles.heartRateCard} variant="elevated" padding="large">
          <View style={styles.heartRateHeader}>
            <Text style={styles.heartRateTitle}>Heart Rate</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusConfig.bgColor },
              ]}
            >
              <Icon name={statusConfig.icon} size={18} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          <View style={styles.heartRateBody}>
            <Animated.View
              style={[
                styles.heartIconContainer,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Icon name="heart-pulse" size={56} color={statusConfig.color} />
            </Animated.View>
            <View style={styles.bpmContainer}>
              <Text style={[styles.bpmNumber, { color: statusConfig.color }]}>
                {currentHeartRate !== null ? currentHeartRate : '--'}
              </Text>
              <Text style={styles.bpmLabel}>BPM</Text>
            </View>
          </View>

          <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>
        </Card>

        {/* Vitals Grid */}
        <Text style={styles.sectionTitle}>Vitals</Text>
        <View style={styles.vitalsGrid}>
          <VitalCard
            icon="water-percent"
            label="SpO2"
            value={spo2 ? `${spo2.value}` : '--'}
            unit="%"
            color={colors.info}
          />
          <VitalCard
            icon="thermometer"
            label="Temperature"
            value={temperature ? `${temperature.value}` : '--'}
            unit={temperature?.unit === 'celsius' ? '\u00B0C' : '\u00B0F'}
            color={colors.accent}
          />
          <VitalCard
            icon="walk"
            label="Steps"
            value={steps ? formatNumber(steps.value) : '--'}
            unit="today"
            color={colors.success}
          />
          <VitalCard
            icon="heart"
            label="Blood Pressure"
            value={bloodPressure ? `${bloodPressure.value}` : '--/--'}
            unit="mmHg"
            color={colors.secondary}
          />
        </View>

        {/* Recent Anomalies */}
        {anomalies.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Anomalies</Text>
            <Card style={styles.anomaliesCard} variant="outlined">
              {anomalies.slice(0, 5).map((anomaly) => (
                <AnomalyItem
                  key={anomaly.metric_id}
                  type={anomaly.metric_type}
                  value={anomaly.value}
                  unit={anomaly.unit}
                  time={getTimeSince(anomaly.recorded_at)}
                />
              ))}
            </Card>
          </>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsRow}>
          <Button
            title="Find Hospital"
            onPress={() => navigation.navigate('Hospitals')}
            variant="secondary"
            icon="hospital-building"
            style={styles.quickActionButton}
            accessibilityLabel="Find a nearby hospital"
          />
          <Button
            title="Emergency SOS"
            onPress={() => navigation.navigate('Emergency')}
            variant="danger"
            icon="alert-octagon"
            style={styles.quickActionButton}
            accessibilityLabel="Open emergency SOS"
          />
        </View>

        {/* Spacer for tab bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Helpers ───────────────────────────────────────────────────

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

function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.base,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  headerGreeting: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginTop: 2,
  },
  settingsButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
  },

  // Heart Rate Card
  heartRateCard: {
    marginBottom: spacing.xl,
  },
  heartRateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  heartRateTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.xs,
  },
  heartRateBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heartIconContainer: {
    marginRight: spacing.lg,
  },
  bpmContainer: {
    alignItems: 'center',
  },
  bpmNumber: {
    fontSize: typography.fontSize.display,
    fontWeight: typography.fontWeight.extrabold,
    lineHeight: 70,
  },
  bpmLabel: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginTop: -4,
  },
  lastUpdated: {
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },

  // Vitals Grid
  sectionTitle: {
    ...typography.heading3,
    marginBottom: spacing.base,
    marginTop: spacing.sm,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  vitalCard: {
    width: '48%',
    marginBottom: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  vitalIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  vitalLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  vitalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  vitalValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  vitalUnit: {
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    marginLeft: spacing.xs,
  },

  // Anomalies
  anomaliesCard: {
    marginBottom: spacing.lg,
  },
  anomalyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  anomalyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    marginRight: spacing.md,
  },
  anomalyContent: {
    flex: 1,
  },
  anomalyType: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  anomalyValue: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  anomalyTime: {
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  quickActionButton: {
    flex: 1,
  },

  // Bottom spacer
  bottomSpacer: {
    height: spacing['3xl'],
  },
});

export default DashboardScreen;
