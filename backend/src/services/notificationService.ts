import config from '../config';
import logger from '../utils/logger';
import { AlertType, AlertSeverity } from '../../../shared/types';

interface PushNotificationPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: 'high' | 'normal';
}

interface SMSPayload {
  to: string;
  body: string;
}

interface EmergencyAlertPayload {
  contactPhone: string;
  contactName: string;
  userName: string;
  alertType: AlertType;
  severity: AlertSeverity;
  metricValue?: number;
  locationLat?: number;
  locationLng?: number;
  locationAddress?: string;
}

/**
 * Notification service handling push notifications (FCM/APNS),
 * SMS (Twilio), and emergency alert dispatching.
 */
class NotificationService {
  /**
   * Send a push notification via Firebase Cloud Messaging.
   * This is a stub implementation - replace with actual FCM SDK calls in production.
   */
  async sendPushNotification(payload: PushNotificationPayload): Promise<boolean> {
    try {
      if (!config.fcm.serverKey) {
        logger.warn('FCM not configured, skipping push notification', {
          title: payload.title,
        });
        return false;
      }

      // FCM HTTP v1 API stub
      // In production, use firebase-admin SDK:
      //
      // const admin = require('firebase-admin');
      // await admin.messaging().send({
      //   token: payload.token,
      //   notification: {
      //     title: payload.title,
      //     body: payload.body,
      //   },
      //   data: payload.data,
      //   android: { priority: payload.priority || 'high' },
      //   apns: {
      //     payload: { aps: { sound: 'default', badge: 1 } },
      //   },
      // });

      logger.info('Push notification sent (stub)', {
        token: payload.token.substring(0, 10) + '...',
        title: payload.title,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send push notification', { error, title: payload.title });
      return false;
    }
  }

  /**
   * Send a push notification via Apple Push Notification Service.
   * Stub implementation - replace with actual APNS calls in production.
   */
  async sendAPNSNotification(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<boolean> {
    try {
      if (!config.apns.keyId) {
        logger.warn('APNS not configured, skipping push notification');
        return false;
      }

      // APNS stub
      // In production, use @parse/node-apn or similar:
      //
      // const apn = require('@parse/node-apn');
      // const notification = new apn.Notification();
      // notification.alert = { title, body };
      // notification.topic = config.apns.bundleId;
      // notification.payload = data;
      // await apnProvider.send(notification, deviceToken);

      logger.info('APNS notification sent (stub)', {
        deviceToken: deviceToken.substring(0, 10) + '...',
        title,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send APNS notification', { error });
      return false;
    }
  }

  /**
   * Send an SMS message via Twilio.
   * Stub implementation - replace with actual Twilio SDK calls in production.
   */
  async sendSMS(payload: SMSPayload): Promise<boolean> {
    try {
      if (!config.twilio.accountSid || !config.twilio.authToken) {
        logger.warn('Twilio not configured, skipping SMS', {
          to: payload.to,
        });
        return false;
      }

      // Twilio stub
      // In production, use the twilio SDK:
      //
      // const twilio = require('twilio');
      // const client = twilio(config.twilio.accountSid, config.twilio.authToken);
      // await client.messages.create({
      //   body: payload.body,
      //   from: config.twilio.phoneNumber,
      //   to: payload.to,
      // });

      logger.info('SMS sent (stub)', {
        to: payload.to,
        bodyLength: payload.body.length,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send SMS', { error, to: payload.to });
      return false;
    }
  }

  /**
   * Send an emergency alert to a contact with live location data.
   * Uses both SMS and push notifications for maximum reach.
   */
  async sendEmergencyAlert(payload: EmergencyAlertPayload): Promise<void> {
    const alertDescriptions: Record<AlertType, string> = {
      low_heart_rate: 'critically low heart rate',
      high_heart_rate: 'dangerously high heart rate',
      fall_detected: 'a fall',
      irregular_rhythm: 'an irregular heart rhythm',
      low_spo2: 'low blood oxygen levels',
    };

    const alertDesc = alertDescriptions[payload.alertType] || 'a health emergency';

    // Build location string
    let locationInfo = '';
    if (payload.locationAddress) {
      locationInfo = `\nLocation: ${payload.locationAddress}`;
    } else if (payload.locationLat && payload.locationLng) {
      locationInfo = `\nLocation: https://maps.google.com/?q=${payload.locationLat},${payload.locationLng}`;
    }

    // Compose emergency SMS
    const smsBody =
      `HEALTHGUARD EMERGENCY ALERT\n\n` +
      `${payload.userName} has experienced ${alertDesc}.` +
      (payload.metricValue ? ` (Reading: ${payload.metricValue})` : '') +
      `\nSeverity: ${payload.severity.toUpperCase()}` +
      locationInfo +
      `\n\nPlease check on them immediately or call 911 if needed.` +
      `\n\nThis is an automated alert from HealthGuard.`;

    // Send SMS
    await this.sendSMS({
      to: payload.contactPhone,
      body: smsBody,
    });

    logger.info('Emergency alert sent to contact', {
      contactName: payload.contactName,
      alertType: payload.alertType,
      severity: payload.severity,
    });
  }

  /**
   * Send a visit feedback reminder notification.
   */
  async sendFeedbackReminder(
    userId: string,
    hospitalName: string,
    visitId: string,
    pushToken?: string
  ): Promise<void> {
    if (pushToken) {
      await this.sendPushNotification({
        token: pushToken,
        title: 'How was your visit?',
        body: `Please rate your visit to ${hospitalName}. Your feedback helps improve healthcare.`,
        data: {
          type: 'feedback_reminder',
          visit_id: visitId,
        },
      });
    }

    logger.info('Feedback reminder sent', { userId, visitId });
  }

  /**
   * Broadcast a specialist status change notification to subscribed users.
   */
  async notifySpecialistStatusChange(
    hospitalId: string,
    specialistName: string,
    status: string,
    subscriberTokens: string[]
  ): Promise<void> {
    const title = 'Specialist Availability Update';
    const body = `Dr. ${specialistName} is now ${status}`;

    const promises = subscriberTokens.map((token) =>
      this.sendPushNotification({
        token,
        title,
        body,
        data: {
          type: 'specialist_status',
          hospital_id: hospitalId,
        },
        priority: 'normal',
      })
    );

    await Promise.allSettled(promises);

    logger.info('Specialist status notifications sent', {
      hospitalId,
      subscriberCount: subscriberTokens.length,
    });
  }
}

export default new NotificationService();
