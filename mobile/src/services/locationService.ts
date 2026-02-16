// ============================================================
// HealthGuard Mobile - Location Service
// ============================================================

import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation, {
  GeoPosition,
  GeoError,
} from 'react-native-geolocation-service';
import type { LocationCoordinates } from '../../shared/types';

// ── Types ─────────────────────────────────────────────────────

interface ReverseGeocodeResult {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  formattedAddress: string;
}

type LocationWatchCallback = (location: LocationCoordinates) => void;

// ── Configuration ─────────────────────────────────────────────

const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 5000,
  distanceFilter: 10, // Update every 10 meters
};

const EMERGENCY_LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0,
  distanceFilter: 5, // Update every 5 meters during emergency
  interval: 3000,
  fastestInterval: 1000,
};

// ── Service Implementation ────────────────────────────────────

class LocationService {
  private watchId: number | null = null;
  private lastKnownLocation: LocationCoordinates | null = null;

  /**
   * Request location permissions from the user.
   * Returns true if permissions are granted.
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const result = await Geolocation.requestAuthorization('whenInUse');
      return result === 'granted';
    }

    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'HealthGuard Location Permission',
          message:
            'HealthGuard needs access to your location to find nearby hospitals and for emergency services.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
          buttonNeutral: 'Ask Later',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    return false;
  }

  /**
   * Request background location permission (for emergency tracking).
   */
  async requestBackgroundPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const result = await Geolocation.requestAuthorization('always');
      return result === 'granted';
    }

    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        {
          title: 'HealthGuard Background Location',
          message:
            'HealthGuard needs continuous location access during emergencies to share your location with emergency contacts and services.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
          buttonNeutral: 'Ask Later',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    return false;
  }

  /**
   * Get the current device location.
   */
  async getCurrentLocation(): Promise<LocationCoordinates | null> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('LocationService: Location permission denied');
      return this.lastKnownLocation;
    }

    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position: GeoPosition) => {
          const location: LocationCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          this.lastKnownLocation = location;
          resolve(location);
        },
        (error: GeoError) => {
          console.error('LocationService: Error getting location:', error.message);
          resolve(this.lastKnownLocation);
        },
        LOCATION_OPTIONS,
      );
    });
  }

  /**
   * Watch location continuously (for emergency tracking).
   * Returns an unsubscribe function.
   */
  watchLocation(
    callback: LocationWatchCallback,
    isEmergency: boolean = false,
  ): () => void {
    // Stop any existing watch
    this.stopWatching();

    const options = isEmergency
      ? EMERGENCY_LOCATION_OPTIONS
      : LOCATION_OPTIONS;

    this.watchId = Geolocation.watchPosition(
      (position: GeoPosition) => {
        const location: LocationCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        this.lastKnownLocation = location;
        callback(location);
      },
      (error: GeoError) => {
        console.error('LocationService: Watch error:', error.message);
      },
      options,
    );

    return () => this.stopWatching();
  }

  /**
   * Stop watching location.
   */
  stopWatching(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Calculate distance between two coordinates in miles.
   * Uses the Haversine formula.
   */
  calculateDistance(
    from: LocationCoordinates,
    to: LocationCoordinates,
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(to.latitude - from.latitude);
    const dLon = this.toRadians(to.longitude - from.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(from.latitude)) *
        Math.cos(this.toRadians(to.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Reverse geocode coordinates to a human-readable address.
   * Uses a simple fetch to a geocoding API.
   */
  async reverseGeocode(
    location: LocationCoordinates,
  ): Promise<ReverseGeocodeResult | null> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${location.latitude}&lon=${location.longitude}&format=json`,
        {
          headers: {
            'User-Agent': 'HealthGuard/1.0',
          },
        },
      );

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();
      const address = data.address || {};

      return {
        address: [address.house_number, address.road].filter(Boolean).join(' '),
        city: address.city || address.town || address.village || '',
        state: address.state || '',
        zipCode: address.postcode || '',
        country: address.country || '',
        formattedAddress: data.display_name || '',
      };
    } catch (error) {
      console.error('LocationService: Reverse geocode failed:', error);
      return null;
    }
  }

  /**
   * Get the last known location without requesting a new one.
   */
  getLastKnownLocation(): LocationCoordinates | null {
    return this.lastKnownLocation;
  }

  // ── Private Helpers ─────────────────────────────────────────

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

// ── Singleton Export ──────────────────────────────────────────

export const locationService = new LocationService();
