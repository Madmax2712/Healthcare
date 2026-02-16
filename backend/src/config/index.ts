import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  isProduction: process.env.NODE_ENV === 'production',

  // Database
  db: {
    host: requireEnv('DB_HOST', 'localhost'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: requireEnv('DB_NAME', 'healthguard'),
    user: requireEnv('DB_USER', 'healthguard_user'),
    password: requireEnv('DB_PASSWORD', ''),
    ssl: process.env.DB_SSL === 'true',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  },

  // JWT
  jwt: {
    secret: requireEnv('JWT_SECRET', 'dev-jwt-secret-not-for-production'),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: requireEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret-not-for-production'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Anthropic AI
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096', 10),
  },

  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },

  // Firebase Cloud Messaging
  fcm: {
    serverKey: process.env.FCM_SERVER_KEY || '',
    projectId: process.env.FCM_PROJECT_ID || '',
  },

  // Apple Push Notification Service
  apns: {
    keyId: process.env.APNS_KEY_ID || '',
    teamId: process.env.APNS_TEAM_ID || '',
    bundleId: process.env.APNS_BUNDLE_ID || 'com.healthguard.app',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },

  // Audit
  audit: {
    enabled: process.env.AUDIT_LOG_ENABLED !== 'false',
    logFile: process.env.AUDIT_LOG_FILE || './logs/audit.log',
  },

  // OTP
  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10),
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
  },
} as const;

export default config;
