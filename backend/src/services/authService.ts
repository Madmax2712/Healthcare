import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import config from '../config';
import { User, HospitalAdmin, AdminRole } from '../../../shared/types';
import logger from '../utils/logger';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface OTPRecord {
  id: string;
  phone_number: string;
  otp_code: string;
  expires_at: string;
  is_used: boolean;
  created_at: string;
}

/**
 * Authentication service handling user registration (phone + OTP),
 * admin login (email + password), token generation, and refresh.
 */
class AuthService {
  private readonly SALT_ROUNDS = 12;

  /**
   * Register a new user with phone number.
   * Sends an OTP for verification.
   */
  async registerUser(data: {
    phone_number: string;
    full_name: string;
    email?: string;
    date_of_birth?: string;
    blood_type?: string;
    allergies?: string[];
    medical_conditions?: string[];
  }): Promise<{ user: User; otp_sent: boolean }> {
    // Check if user already exists
    const existingUser = await db('users')
      .where('phone_number', data.phone_number)
      .first();

    if (existingUser) {
      throw new Error('A user with this phone number already exists.');
    }

    const userId = uuidv4();
    const now = new Date().toISOString();

    const [user] = await db('users')
      .insert({
        user_id: userId,
        phone_number: data.phone_number,
        full_name: data.full_name,
        email: data.email || null,
        date_of_birth: data.date_of_birth || null,
        blood_type: data.blood_type || null,
        allergies: data.allergies ? JSON.stringify(data.allergies) : null,
        medical_conditions: data.medical_conditions ? JSON.stringify(data.medical_conditions) : null,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .returning('*');

    // Generate and send OTP
    const otpSent = await this.generateAndSendOTP(data.phone_number);

    logger.info('User registered', { userId, phoneNumber: data.phone_number });

    return { user, otp_sent: otpSent };
  }

  /**
   * Login a user with phone number + OTP.
   */
  async loginUser(phoneNumber: string, otpCode: string): Promise<{
    user: User;
    tokens: TokenPair;
  }> {
    // Verify OTP
    const isValidOTP = await this.verifyOTP(phoneNumber, otpCode);
    if (!isValidOTP) {
      throw new Error('Invalid or expired OTP.');
    }

    // Find user
    const user = await db('users')
      .where('phone_number', phoneNumber)
      .where('is_active', true)
      .first();

    if (!user) {
      throw new Error('User not found or inactive.');
    }

    // Update last login
    await db('users')
      .where('user_id', user.user_id)
      .update({ last_login: new Date().toISOString() });

    // Generate tokens
    const tokens = this.generateTokenPair({
      userId: user.user_id,
      type: 'user',
    });

    logger.info('User logged in', { userId: user.user_id });

    return { user, tokens };
  }

  /**
   * Login a hospital admin with email + password.
   */
  async loginAdmin(email: string, password: string): Promise<{
    admin: HospitalAdmin;
    tokens: TokenPair;
  }> {
    // Find admin with password hash
    const admin = await db('hospital_admins')
      .where('email', email)
      .where('is_active', true)
      .first();

    if (!admin) {
      throw new Error('Invalid email or password.');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password.');
    }

    // Update last login
    await db('hospital_admins')
      .where('admin_id', admin.admin_id)
      .update({ last_login: new Date().toISOString() });

    // Generate tokens
    const tokens = this.generateTokenPair({
      userId: admin.admin_id,
      type: 'admin',
      hospitalId: admin.hospital_id,
      role: admin.role as AdminRole,
    });

    // Remove password hash from response
    const { password_hash, ...adminData } = admin;

    logger.info('Admin logged in', { adminId: admin.admin_id, hospitalId: admin.hospital_id });

    return { admin: adminData, tokens };
  }

  /**
   * Generate a JWT access token.
   */
  generateToken(payload: {
    userId: string;
    type: 'user' | 'admin';
    hospitalId?: string;
    role?: AdminRole;
  }): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
  }

  /**
   * Generate both access and refresh tokens.
   */
  generateTokenPair(payload: {
    userId: string;
    type: 'user' | 'admin';
    hospitalId?: string;
    role?: AdminRole;
  }): TokenPair {
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(
      { userId: payload.userId, type: payload.type, tokenType: 'refresh' },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn } as jwt.SignOptions
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
    };
  }

  /**
   * Refresh an access token using a valid refresh token.
   */
  async refreshToken(refreshTokenStr: string): Promise<TokenPair> {
    try {
      const decoded = jwt.verify(refreshTokenStr, config.jwt.refreshSecret) as {
        userId: string;
        type: 'user' | 'admin';
        tokenType: string;
      };

      if (decoded.tokenType !== 'refresh') {
        throw new Error('Invalid token type.');
      }

      // Verify user/admin still exists and is active
      if (decoded.type === 'user') {
        const user = await db('users')
          .where('user_id', decoded.userId)
          .where('is_active', true)
          .first();

        if (!user) {
          throw new Error('User not found or inactive.');
        }

        return this.generateTokenPair({
          userId: decoded.userId,
          type: 'user',
        });
      } else {
        const admin = await db('hospital_admins')
          .where('admin_id', decoded.userId)
          .where('is_active', true)
          .first();

        if (!admin) {
          throw new Error('Admin not found or inactive.');
        }

        return this.generateTokenPair({
          userId: decoded.userId,
          type: 'admin',
          hospitalId: admin.hospital_id,
          role: admin.role as AdminRole,
        });
      }
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token has expired. Please log in again.');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token.');
      }
      throw error;
    }
  }

  /**
   * Generate an OTP and store it in the database.
   * In production, this would also send the OTP via SMS.
   */
  async generateAndSendOTP(phoneNumber: string): Promise<boolean> {
    // Invalidate any existing OTPs for this phone number
    await db('otp_codes')
      .where('phone_number', phoneNumber)
      .where('is_used', false)
      .update({ is_used: true });

    // Generate a random OTP
    const otpLength = config.otp.length;
    const otp = Array.from({ length: otpLength }, () =>
      Math.floor(Math.random() * 10)
    ).join('');

    const expiresAt = new Date(
      Date.now() + config.otp.expiryMinutes * 60 * 1000
    ).toISOString();

    await db('otp_codes').insert({
      id: uuidv4(),
      phone_number: phoneNumber,
      otp_code: otp,
      expires_at: expiresAt,
      is_used: false,
      created_at: new Date().toISOString(),
    });

    // In production, send OTP via SMS:
    // await notificationService.sendSMS({
    //   to: phoneNumber,
    //   body: `Your HealthGuard verification code is: ${otp}. Valid for ${config.otp.expiryMinutes} minutes.`,
    // });

    logger.info('OTP generated', {
      phoneNumber,
      expiresAt,
      // In development, log the OTP for testing
      ...(config.env === 'development' ? { otp } : {}),
    });

    return true;
  }

  /**
   * Verify an OTP code for a phone number.
   */
  async verifyOTP(phoneNumber: string, otpCode: string): Promise<boolean> {
    const record = await db('otp_codes')
      .where('phone_number', phoneNumber)
      .where('otp_code', otpCode)
      .where('is_used', false)
      .where('expires_at', '>', new Date().toISOString())
      .orderBy('created_at', 'desc')
      .first() as OTPRecord | undefined;

    if (!record) {
      return false;
    }

    // Mark OTP as used
    await db('otp_codes')
      .where('id', record.id)
      .update({ is_used: true });

    return true;
  }

  /**
   * Hash a password for admin accounts.
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Send OTP for login (used when user already exists).
   */
  async sendLoginOTP(phoneNumber: string): Promise<boolean> {
    const user = await db('users')
      .where('phone_number', phoneNumber)
      .where('is_active', true)
      .first();

    if (!user) {
      // Do not reveal whether the user exists for security
      throw new Error('If this phone number is registered, an OTP has been sent.');
    }

    return this.generateAndSendOTP(phoneNumber);
  }
}

export default new AuthService();
