// ============================================================
// HealthGuard Mobile - Emergency Service
// ============================================================
// Provides emergency functions: trigger alerts, call 911,
// share location with contacts, and coordinate responses.
// ============================================================

import { Linking, Platform, Vibration, Alert } from 'react-native';
import Communications from 'react-native-communications';
import type { EmergencyAlert, LocationCoordinates } from '../../shared/types';
import { useEmergencyStore } from '../store/emergencyStore';
import { useAuthStore } from '../store/authStore';
import { locationService } from './locationService';
import { socketService } from './socketService';
import { emergencyAPI } from '../api/endpoints';

// ── Configuration ─────────────────────────────────────────────

const EMERGENCY_NUMBER = '911';
const VIBRATION_PATTERN = [500, 500, 500, 500, 500]; // Urgent vibration
const LOCATION_SHARE_INTERVAL_MS = 10000; // Share location every 10 seconds

// ── Types ─────────────────────────────────────────────────────

interface EmergencyTriggerResult {
  alert: EmergencyAlert | null;
  contactsNotified: boolean;
  locationShared: boolean;
}

// ── Service Implementation ────────────────────────────────────

class EmergencyService {
  private locationShareInterval: ReturnType<typeof setInterval> | null = null;
  private locationWatchUnsubscribe: (() => void) | null = null;

  /**
   * Trigger a full emergency alert:
   * 1. Get current location
   * 2. Create alert on backend
   * 3. Notify emergency contacts
   * 4. Start location sharing
   * 5. Vibrate device
   */
  async triggerEmergencyAlert(
    alertType: EmergencyAlert['alert_type'],
    severity: EmergencyAlert['severity'],
    metricValue?: number,
  ): Promise<EmergencyTriggerResult> {
    const result: EmergencyTriggerResult = {
      alert: null,
      contactsNotified: false,
      locationShared: false,
    };

    // Vibrate to indicate emergency activation
    Vibration.vibrate(VIBRATION_PATTERN);

    try {
      // 1. Get current location
      const location = await locationService.getCurrentLocation();
      let locationAddress: string | undefined;

      if (location) {
        const geocode = await locationService.reverseGeocode(location);
        if (geocode) {
          locationAddress = geocode.formattedAddress;
        }
      }

      // 2. Create alert on backend
      const emergencyStore = useEmergencyStore.getState();
      const alert = await emergencyStore.createAlert({
        alert_type: alertType,
        severity,
        metric_value: metricValue,
        location_lat: location?.latitude,
        location_lng: location?.longitude,
        location_address: locationAddress,
      });

      result.alert = alert;

      if (alert) {
        // 3. Notify emergency contacts
        try {
          await emergencyStore.notifyContacts(alert.alert_id);
          result.contactsNotified = true;

          // Update contact notification statuses
          const contacts = useAuthStore.getState().emergencyContacts;
          contacts.forEach((contact) => {
            emergencyStore.addContactNotification({
              contactId: contact.contact_id,
              contactName: contact.contact_name,
              status: 'sent',
            });
          });
        } catch (err) {
          console.error('EmergencyService: Failed to notify contacts:', err);
        }

        // 4. Start continuous location sharing
        if (location) {
          this.startLocationSharing(alert.alert_id, location);
          result.locationShared = true;
        }
      }
    } catch (err) {
      console.error('EmergencyService: Failed to trigger alert:', err);
    }

    return result;
  }

  /**
   * One-tap call to 911 emergency services.
   */
  callEmergencyServices(): void {
    const emergencyStore = useEmergencyStore.getState();
    emergencyStore.setCallingServices(true);

    if (Platform.OS === 'ios') {
      // On iOS, use tel: scheme which prompts the user
      Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch((err) => {
        console.error('EmergencyService: Failed to call 911:', err);
        Alert.alert(
          'Unable to Call',
          `Please call ${EMERGENCY_NUMBER} manually.`,
          [{ text: 'OK' }],
        );
      });
    } else {
      // On Android, use Communications library
      Communications.phonecall(EMERGENCY_NUMBER, true);
    }
  }

  /**
   * Share current location with all emergency contacts via SMS.
   */
  async shareLocationWithContacts(): Promise<void> {
    const location = await locationService.getCurrentLocation();
    if (!location) {
      Alert.alert(
        'Location Unavailable',
        'Unable to determine your current location. Please try again.',
        [{ text: 'OK' }],
      );
      return;
    }

    const geocode = await locationService.reverseGeocode(location);
    const address = geocode?.formattedAddress || 'Unknown location';
    const mapsUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;

    const message =
      `HEALTHGUARD EMERGENCY: I need help!\n\n` +
      `My current location:\n${address}\n\n` +
      `Map: ${mapsUrl}\n\n` +
      `This is an automated message from HealthGuard.`;

    const contacts = useAuthStore.getState().emergencyContacts;

    if (contacts.length === 0) {
      Alert.alert(
        'No Emergency Contacts',
        'Please add emergency contacts in your profile settings.',
        [{ text: 'OK' }],
      );
      return;
    }

    // Send SMS to each contact
    contacts.forEach((contact) => {
      try {
        Communications.text(contact.phone_number, message);
      } catch (err) {
        console.error(
          `EmergencyService: Failed to send SMS to ${contact.contact_name}:`,
          err,
        );
      }
    });
  }

  /**
   * Start continuous location sharing during an emergency.
   */
  private startLocationSharing(
    alertId: string,
    initialLocation: LocationCoordinates,
  ): void {
    const emergencyStore = useEmergencyStore.getState();
    emergencyStore.setCurrentLocation(initialLocation);

    // Watch location changes
    this.locationWatchUnsubscribe = locationService.watchLocation(
      (location) => {
        emergencyStore.setCurrentLocation(location);

        // Send location update via socket
        socketService.sendHealthMetric({
          metric_type: 'heart_rate',
          value: 0,
          is_anomaly: true,
        });
      },
      true, // emergency mode for higher accuracy
    );

    // Periodically send location to backend
    this.locationShareInterval = setInterval(async () => {
      const currentLocation = locationService.getLastKnownLocation();
      if (currentLocation) {
        try {
          // The backend will relay location to emergency contacts
          await emergencyAPI.createAlert({
            alert_type: 'low_heart_rate',
            severity: 'low',
            location_lat: currentLocation.latitude,
            location_lng: currentLocation.longitude,
          });
        } catch {
          // Continue sharing even if one update fails
        }
      }
    }, LOCATION_SHARE_INTERVAL_MS);
  }

  /**
   * Stop location sharing (when emergency is resolved).
   */
  stopLocationSharing(): void {
    if (this.locationShareInterval) {
      clearInterval(this.locationShareInterval);
      this.locationShareInterval = null;
    }

    if (this.locationWatchUnsubscribe) {
      this.locationWatchUnsubscribe();
      this.locationWatchUnsubscribe = null;
    }

    locationService.stopWatching();
  }

  /**
   * Resolve an active emergency.
   */
  async resolveEmergency(
    alertId: string,
    isFalseAlarm: boolean,
  ): Promise<void> {
    // Stop location sharing
    this.stopLocationSharing();

    // Stop vibration
    Vibration.cancel();

    // Resolve the alert
    const emergencyStore = useEmergencyStore.getState();
    await emergencyStore.resolveAlert(
      alertId,
      isFalseAlarm ? 'false_alarm' : 'resolved',
    );

    emergencyStore.clearEmergency();
  }
}

// ── Singleton Export ──────────────────────────────────────────

export const emergencyService = new EmergencyService();
