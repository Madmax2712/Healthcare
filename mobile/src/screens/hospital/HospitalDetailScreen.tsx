// ============================================================
// HealthGuard Mobile - Hospital Detail Screen
// ============================================================
// Displays hospital information, capabilities, contact options,
// and specialist list with availability and booking.
// ============================================================

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Header from '../../components/common/Header';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StarRating from '../../components/common/StarRating';
import { useHospitalStore } from '../../store/hospitalStore';
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  touchTargets,
} from '../../theme';
import type { HospitalSpecialist } from '../../../shared/types';
import type { HospitalStackParamList } from '../../navigation/AppNavigator';

// ── Types ─────────────────────────────────────────────────────

type HospitalDetailRouteProp = RouteProp<HospitalStackParamList, 'HospitalDetail'>;
type HospitalDetailNavigationProp = StackNavigationProp<
  HospitalStackParamList,
  'HospitalDetail'
>;

interface HospitalDetailScreenProps {
  route: HospitalDetailRouteProp;
  navigation: HospitalDetailNavigationProp;
}

// ── Info Row Sub-Component ────────────────────────────────────

interface InfoRowProps {
  icon: string;
  label: string;
  value: string | number | boolean;
  valueColor?: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, valueColor }) => {
  let displayValue: string;
  if (typeof value === 'boolean') {
    displayValue = value ? 'Yes' : 'No';
  } else {
    displayValue = String(value);
  }

  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={24} color={colors.textTertiary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          valueColor ? { color: valueColor } : null,
        ]}
      >
        {displayValue}
      </Text>
    </View>
  );
};

// ── Specialist Card Sub-Component ─────────────────────────────

interface SpecialistCardProps {
  specialist: HospitalSpecialist;
  onBook: () => void;
}

const SpecialistCard: React.FC<SpecialistCardProps> = ({ specialist, onBook }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'available':
        return { label: 'Available', color: colors.success, bg: colors.successLight };
      case 'busy':
        return { label: 'Busy', color: colors.warning, bg: colors.warningLight };
      default:
        return { label: 'Off Duty', color: colors.textTertiary, bg: colors.background };
    }
  };

  const statusConfig = getStatusConfig(specialist.availability_status);

  return (
    <Card style={styles.specialistCard} variant="outlined" padding="default">
      <View style={styles.specialistHeader}>
        <View style={styles.specialistAvatar}>
          <Icon name="doctor" size={28} color={colors.primary} />
        </View>
        <View style={styles.specialistInfo}>
          <Text style={styles.specialistName}>{specialist.doctor_name}</Text>
          <Text style={styles.specialistSpecialty}>
            {specialist.specialty?.specialty_name || 'Specialist'}
          </Text>
          {specialist.years_of_experience && (
            <Text style={styles.specialistExperience}>
              {specialist.years_of_experience} years experience
            </Text>
          )}
        </View>
        <View style={[styles.availabilityBadge, { backgroundColor: statusConfig.bg }]}>
          <View style={[styles.availabilityDot, { backgroundColor: statusConfig.color }]} />
          <Text style={[styles.availabilityText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      <View style={styles.specialistFooter}>
        {specialist.consultation_fee !== undefined && specialist.consultation_fee !== null && (
          <Text style={styles.consultationFee}>
            ${specialist.consultation_fee.toFixed(0)} consultation
          </Text>
        )}
        {specialist.is_available && (
          <Button
            title="Book Visit"
            onPress={onBook}
            variant="primary"
            size="small"
            icon="calendar-plus"
            accessibilityLabel={`Book visit with ${specialist.doctor_name}`}
          />
        )}
      </View>
    </Card>
  );
};

// ── Main Component ────────────────────────────────────────────

const HospitalDetailScreen: React.FC<HospitalDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const { hospitalId, hospitalName } = route.params;

  const {
    selectedHospital,
    specialists,
    isLoading,
    error,
    fetchHospital,
    fetchHospitalSpecialists,
  } = useHospitalStore();

  useEffect(() => {
    fetchHospital(hospitalId);
    fetchHospitalSpecialists(hospitalId);
  }, [hospitalId, fetchHospital, fetchHospitalSpecialists]);

  const handleCall = useCallback(() => {
    if (!selectedHospital?.phone_number) return;
    Linking.openURL(`tel:${selectedHospital.phone_number}`).catch(() => {
      Alert.alert(
        'Unable to Call',
        `Please call ${selectedHospital.phone_number} manually.`,
      );
    });
  }, [selectedHospital]);

  const handleWebsite = useCallback(() => {
    if (!selectedHospital?.website_url) return;
    Linking.openURL(selectedHospital.website_url).catch(() => {
      Alert.alert('Unable to Open', 'Could not open the website.');
    });
  }, [selectedHospital]);

  const handleDirections = useCallback(() => {
    if (!selectedHospital) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedHospital.latitude},${selectedHospital.longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to Open', 'Could not open maps.');
    });
  }, [selectedHospital]);

  const handleBookVisit = useCallback(
    (specialist: HospitalSpecialist) => {
      Alert.alert(
        'Book Visit',
        `Schedule a visit with ${specialist.doctor_name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Book',
            onPress: () => {
              Alert.alert(
                'Visit Requested',
                'Your visit request has been submitted. You will receive a confirmation shortly.',
              );
            },
          },
        ],
      );
    },
    [],
  );

  if (isLoading && !selectedHospital) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title={hospitalName}
          showBack
          onBackPress={() => navigation.goBack()}
        />
        <LoadingSpinner fullScreen message="Loading hospital details..." />
      </SafeAreaView>
    );
  }

  const hospital = selectedHospital;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title={hospitalName}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {hospital && (
          <>
            {/* Hospital Name & Rating */}
            <View style={styles.heroSection}>
              <Text style={styles.hospitalName}>{hospital.hospital_name}</Text>
              <View style={styles.addressRow}>
                <Icon name="map-marker" size={22} color={colors.textTertiary} />
                <Text style={styles.addressText}>
                  {hospital.address}, {hospital.city}, {hospital.state}{' '}
                  {hospital.zip_code || ''}
                </Text>
              </View>
              {hospital.rating !== undefined && hospital.rating !== null && (
                <View style={styles.ratingContainer}>
                  <StarRating
                    rating={hospital.rating}
                    readonly
                    starSize={28}
                    showValue
                  />
                </View>
              )}
            </View>

            {/* Contact Buttons */}
            <View style={styles.contactButtonsRow}>
              <TouchableOpacity
                style={styles.contactButton}
                onPress={handleCall}
                accessibilityRole="button"
                accessibilityLabel="Call hospital"
              >
                <View style={[styles.contactIconCircle, { backgroundColor: colors.success + '20' }]}>
                  <Icon name="phone" size={28} color={colors.success} />
                </View>
                <Text style={styles.contactButtonLabel}>Call</Text>
              </TouchableOpacity>

              {hospital.website_url && (
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={handleWebsite}
                  accessibilityRole="button"
                  accessibilityLabel="Visit website"
                >
                  <View style={[styles.contactIconCircle, { backgroundColor: colors.info + '20' }]}>
                    <Icon name="web" size={28} color={colors.info} />
                  </View>
                  <Text style={styles.contactButtonLabel}>Website</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.contactButton}
                onPress={handleDirections}
                accessibilityRole="button"
                accessibilityLabel="Get directions"
              >
                <View style={[styles.contactIconCircle, { backgroundColor: colors.secondary + '20' }]}>
                  <Icon name="directions" size={28} color={colors.secondary} />
                </View>
                <Text style={styles.contactButtonLabel}>Directions</Text>
              </TouchableOpacity>
            </View>

            {/* Hospital Info */}
            <Text style={styles.sectionTitle}>Hospital Information</Text>
            <Card style={styles.infoCard} variant="outlined">
              <InfoRow
                icon="ambulance"
                label="Emergency Services"
                value={hospital.emergency_services}
                valueColor={hospital.emergency_services ? colors.success : colors.danger}
              />
              <InfoRow
                icon="heart-pulse"
                label="ICU"
                value={hospital.has_icu}
                valueColor={hospital.has_icu ? colors.success : colors.textTertiary}
              />
              <InfoRow
                icon="hospital"
                label="Trauma Center"
                value={hospital.has_trauma_center}
                valueColor={hospital.has_trauma_center ? colors.success : colors.textTertiary}
              />
              {hospital.total_beds !== undefined && hospital.total_beds !== null && (
                <InfoRow
                  icon="bed"
                  label="Total Beds"
                  value={hospital.total_beds}
                />
              )}
              {hospital.trauma_level && (
                <InfoRow
                  icon="alert-decagram"
                  label="Trauma Level"
                  value={hospital.trauma_level}
                />
              )}
            </Card>

            {/* Specialists */}
            <Text style={styles.sectionTitle}>Specialists</Text>
            {isLoading && specialists.length === 0 ? (
              <LoadingSpinner message="Loading specialists..." />
            ) : specialists.length === 0 ? (
              <Card style={styles.emptySpecialistsCard} variant="outlined">
                <Icon name="doctor" size={48} color={colors.textTertiary} />
                <Text style={styles.emptySpecialistsText}>
                  No specialists listed at this time
                </Text>
              </Card>
            ) : (
              specialists.map((specialist) => (
                <SpecialistCard
                  key={specialist.specialist_id}
                  specialist={specialist}
                  onBook={() => handleBookVisit(specialist)}
                />
              ))
            )}

            {/* Bottom spacer */}
            <View style={styles.bottomSpacer} />
          </>
        )}

        {error && !hospital && (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.errorTitle}>Failed to load hospital</Text>
            <Text style={styles.errorSubtitle}>{error}</Text>
            <Button
              title="Retry"
              onPress={() => fetchHospital(hospitalId)}
              variant="outline"
              icon="refresh"
              style={styles.retryButton}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
  },

  // Hero
  heroSection: {
    marginBottom: spacing.xl,
  },
  hospitalName: {
    ...typography.heading1,
    marginBottom: spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  addressText: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  ratingContainer: {
    marginTop: spacing.sm,
    alignItems: 'flex-start',
  },

  // Contact Buttons
  contactButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  contactButton: {
    alignItems: 'center',
    minWidth: 80,
  },
  contactIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  contactButtonLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },

  // Info Section
  sectionTitle: {
    ...typography.heading3,
    marginBottom: spacing.base,
  },
  infoCard: {
    marginBottom: spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginLeft: spacing.md,
    flex: 1,
  },
  infoValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },

  // Specialists
  specialistCard: {
    marginBottom: spacing.md,
  },
  specialistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  specialistAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  specialistInfo: {
    flex: 1,
  },
  specialistName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  specialistSpecialty: {
    fontSize: typography.fontSize.base,
    color: colors.secondary,
    marginTop: 2,
  },
  specialistExperience: {
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    marginTop: 2,
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  availabilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  availabilityText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  specialistFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
  },
  consultationFee: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  emptySpecialistsCard: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    marginBottom: spacing.xl,
  },
  emptySpecialistsText: {
    ...typography.body,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },

  // Error
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
  },
  errorTitle: {
    ...typography.heading3,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    minWidth: 140,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});

export default HospitalDetailScreen;
