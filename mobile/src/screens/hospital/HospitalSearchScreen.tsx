// ============================================================
// HealthGuard Mobile - Hospital Search Screen
// ============================================================
// Search and filter hospitals by distance, specialty, and
// availability. Shows hospital cards with ratings, badges,
// and action buttons.
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StarRating from '../../components/common/StarRating';
import { useHospitalStore } from '../../store/hospitalStore';
import { locationService } from '../../services/locationService';
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  touchTargets,
  layout,
} from '../../theme';
import type { Hospital } from '../../../shared/types';
import type { HospitalStackParamList } from '../../navigation/AppNavigator';

// ── Types ─────────────────────────────────────────────────────

type HospitalSearchNavigationProp = StackNavigationProp<
  HospitalStackParamList,
  'HospitalSearch'
>;

// ── Filter Chip Sub-Component ─────────────────────────────────

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: string;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, active, onPress, icon }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.filterChip, active && styles.filterChipActive]}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    accessibilityLabel={`${label} filter`}
  >
    {icon && (
      <Icon
        name={icon}
        size={18}
        color={active ? colors.white : colors.textSecondary}
        style={styles.filterChipIcon}
      />
    )}
    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ── Hospital Card Sub-Component ───────────────────────────────

interface HospitalCardProps {
  hospital: Hospital;
  onPress: () => void;
  onDirections: () => void;
  onCall: () => void;
}

const HospitalCard: React.FC<HospitalCardProps> = ({
  hospital,
  onPress,
  onDirections,
  onCall,
}) => (
  <Card style={styles.hospitalCard} onPress={onPress} variant="elevated" padding="large">
    <View style={styles.hospitalCardHeader}>
      <View style={styles.hospitalNameContainer}>
        <Text style={styles.hospitalName} numberOfLines={2}>
          {hospital.hospital_name}
        </Text>
        {hospital.rating !== undefined && hospital.rating !== null && (
          <View style={styles.ratingRow}>
            <StarRating
              rating={hospital.rating}
              readonly
              starSize={20}
              showValue
            />
          </View>
        )}
      </View>
      {hospital.distance !== undefined && (
        <View style={styles.distanceBadge}>
          <Icon name="map-marker-distance" size={18} color={colors.secondary} />
          <Text style={styles.distanceText}>{hospital.distance} mi</Text>
        </View>
      )}
    </View>

    <View style={styles.addressRow}>
      <Icon name="map-marker" size={20} color={colors.textTertiary} />
      <Text style={styles.addressText} numberOfLines={2}>
        {hospital.address}, {hospital.city}, {hospital.state}
      </Text>
    </View>

    {/* Badges */}
    <View style={styles.badgesRow}>
      {hospital.emergency_services && (
        <View style={[styles.badge, styles.badgeER]}>
          <Icon name="ambulance" size={16} color={colors.white} />
          <Text style={styles.badgeText}>ER</Text>
        </View>
      )}
      {hospital.has_icu && (
        <View style={[styles.badge, styles.badgeICU]}>
          <Icon name="heart-pulse" size={16} color={colors.white} />
          <Text style={styles.badgeText}>ICU</Text>
        </View>
      )}
      {hospital.has_trauma_center && (
        <View style={[styles.badge, styles.badgeTrauma]}>
          <Icon name="hospital" size={16} color={colors.white} />
          <Text style={styles.badgeText}>Trauma</Text>
        </View>
      )}
    </View>

    {/* Action Buttons */}
    <View style={styles.actionButtonsRow}>
      <TouchableOpacity
        onPress={onDirections}
        style={styles.actionButton}
        accessibilityRole="button"
        accessibilityLabel="Get directions"
      >
        <Icon name="directions" size={24} color={colors.secondary} />
        <Text style={styles.actionButtonText}>Directions</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onCall}
        style={styles.actionButton}
        accessibilityRole="button"
        accessibilityLabel={`Call ${hospital.hospital_name}`}
      >
        <Icon name="phone" size={24} color={colors.success} />
        <Text style={[styles.actionButtonText, { color: colors.success }]}>Call</Text>
      </TouchableOpacity>
    </View>
  </Card>
);

// ── Main Component ────────────────────────────────────────────

const HospitalSearchScreen: React.FC = () => {
  const navigation = useNavigation<HospitalSearchNavigationProp>();
  const {
    hospitals,
    isSearching,
    showEmergencyOnly,
    showAvailableOnly,
    searchQuery,
    setShowEmergencyOnly,
    setShowAvailableOnly,
    setSearchQuery,
    searchHospitals,
    fetchSpecialties,
    error,
  } = useHospitalStore();

  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Load specialties and do initial search
  useEffect(() => {
    const init = async () => {
      fetchSpecialties();
      const location = await locationService.getCurrentLocation();
      if (location) {
        setHasLocationPermission(true);
        await searchHospitals(location);
      } else {
        Alert.alert(
          'Location Required',
          'Please enable location services to find nearby hospitals.',
          [{ text: 'OK' }],
        );
      }
      setInitialLoading(false);
    };
    init();
  }, [fetchSpecialties, searchHospitals]);

  // Re-search when filters change
  useEffect(() => {
    if (!hasLocationPermission || initialLoading) return;
    const doSearch = async () => {
      const location = await locationService.getCurrentLocation();
      if (location) {
        searchHospitals(location);
      }
    };
    doSearch();
  }, [showEmergencyOnly, showAvailableOnly, hasLocationPermission, initialLoading, searchHospitals]);

  const handleSearch = useCallback(
    async (text: string) => {
      setSearchQuery(text);
    },
    [setSearchQuery],
  );

  const handleHospitalPress = useCallback(
    (hospital: Hospital) => {
      navigation.navigate('HospitalDetail', {
        hospitalId: hospital.hospital_id,
        hospitalName: hospital.hospital_name,
      });
    },
    [navigation],
  );

  const handleDirections = useCallback((hospital: Hospital) => {
    const scheme = Platform.select({
      ios: 'maps:',
      android: 'geo:',
    });
    const url = Platform.select({
      ios: `maps:0,0?q=${hospital.latitude},${hospital.longitude}(${encodeURIComponent(hospital.hospital_name)})`,
      android: `geo:0,0?q=${hospital.latitude},${hospital.longitude}(${encodeURIComponent(hospital.hospital_name)})`,
    });
    if (url) {
      Linking.openURL(url).catch(() => {
        // Fallback to Google Maps web
        Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${hospital.latitude},${hospital.longitude}`,
        );
      });
    }
  }, []);

  const handleCall = useCallback((hospital: Hospital) => {
    const phoneUrl = `tel:${hospital.phone_number}`;
    Linking.openURL(phoneUrl).catch(() => {
      Alert.alert('Unable to Call', `Please call ${hospital.phone_number} manually.`);
    });
  }, []);

  // Filter hospitals by search query
  const filteredHospitals = hospitals.filter((h) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      h.hospital_name.toLowerCase().includes(query) ||
      h.address.toLowerCase().includes(query) ||
      h.city.toLowerCase().includes(query)
    );
  });

  const renderHospitalItem = useCallback(
    ({ item }: { item: Hospital }) => (
      <HospitalCard
        hospital={item}
        onPress={() => handleHospitalPress(item)}
        onDirections={() => handleDirections(item)}
        onCall={() => handleCall(item)}
      />
    ),
    [handleHospitalPress, handleDirections, handleCall],
  );

  const keyExtractor = useCallback((item: Hospital) => item.hospital_id, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Find Hospitals</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <Icon name="magnify" size={24} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="Search hospitals..."
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
            accessibilityLabel="Search hospitals"
            accessibilityHint="Type to filter hospitals by name or location"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon name="close-circle" size={22} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersContainer}>
        <FilterChip
          label="Emergency Only"
          active={showEmergencyOnly}
          onPress={() => setShowEmergencyOnly(!showEmergencyOnly)}
          icon="ambulance"
        />
        <FilterChip
          label="Available Now"
          active={showAvailableOnly}
          onPress={() => setShowAvailableOnly(!showAvailableOnly)}
          icon="clock-check"
        />
      </View>

      {/* Hospital List */}
      {initialLoading || (isSearching && hospitals.length === 0) ? (
        <LoadingSpinner
          fullScreen
          message="Finding nearby hospitals..."
        />
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Icon name="alert-circle-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
        </View>
      ) : filteredHospitals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="hospital-building" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No hospitals found</Text>
          <Text style={styles.emptySubtitle}>
            Try adjusting your search or filters
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredHospitals}
          renderItem={renderHospitalItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
          ListFooterComponent={<View style={styles.bottomSpacer} />}
        />
      )}
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.base,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: {
    ...typography.heading2,
    color: colors.primary,
  },

  // Search Bar
  searchBarContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    height: layout.inputHeight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    paddingVertical: 0,
  },

  // Filters
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: touchTargets.minimum,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipIcon: {
    marginRight: spacing.xs,
  },
  filterChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.white,
  },

  // Hospital Card
  hospitalCard: {
    marginHorizontal: spacing.screenPadding,
  },
  hospitalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  hospitalNameContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  hospitalName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  distanceText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.secondary,
    marginLeft: spacing.xs,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  addressText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 22,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  badgeER: {
    backgroundColor: colors.danger,
  },
  badgeICU: {
    backgroundColor: colors.secondary,
  },
  badgeTrauma: {
    backgroundColor: colors.accent,
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: touchTargets.minimum,
  },
  actionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.secondary,
    marginLeft: spacing.sm,
  },

  // List
  listContent: {
    paddingTop: spacing.md,
  },
  listSeparator: {
    height: spacing.md,
  },

  // Empty / Error States
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  emptyTitle: {
    ...typography.heading3,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});

export default HospitalSearchScreen;
