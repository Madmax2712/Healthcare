// ============================================================
// HealthGuard Mobile - Auth Store (Zustand)
// ============================================================

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, EmergencyContact } from '../../shared/types';
import { authAPI, contactsAPI } from '../api/endpoints';
import { setAuthTokens, clearAuthTokens } from '../api/client';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  emergencyContacts: EmergencyContact[];
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  requestOTP: (phoneNumber: string) => Promise<string>;
  verifyOTP: (phoneNumber: string, otp: string, sessionId: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  fetchProfile: () => Promise<void>;
  fetchEmergencyContacts: () => Promise<void>;
  addEmergencyContact: (
    data: Omit<EmergencyContact, 'contact_id' | 'user_id' | 'created_at'>,
  ) => Promise<void>;
  removeEmergencyContact: (contactId: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  emergencyContacts: [],
  error: null,

  initialize: async () => {
    try {
      set({ isLoading: true });
      const token = await AsyncStorage.getItem('@healthguard_auth_token');
      if (token) {
        const response = await authAPI.getProfile();
        if (response.data.success && response.data.data) {
          set({
            user: response.data.data,
            isAuthenticated: true,
          });
          // Fetch emergency contacts in background
          get().fetchEmergencyContacts();
        }
      }
    } catch {
      await clearAuthTokens();
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false, isInitialized: true });
    }
  },

  requestOTP: async (phoneNumber: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await authAPI.requestOTP(phoneNumber);
      if (response.data.success && response.data.data) {
        return response.data.data.session_id;
      }
      throw new Error(response.data.error || 'Failed to send OTP');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to send verification code';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  verifyOTP: async (phoneNumber: string, otp: string, sessionId: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await authAPI.verifyOTP(phoneNumber, otp, sessionId);
      if (response.data.success && response.data.data) {
        const { user, access_token, refresh_token, is_new_user } = response.data.data;
        await setAuthTokens(access_token, refresh_token);
        set({
          user,
          isAuthenticated: true,
        });
        return is_new_user;
      }
      throw new Error(response.data.error || 'Invalid verification code');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Verification failed';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch {
      // Proceed with local logout even if API call fails
    } finally {
      await clearAuthTokens();
      set({
        user: null,
        isAuthenticated: false,
        emergencyContacts: [],
        error: null,
      });
    }
  },

  updateProfile: async (data: Partial<User>) => {
    try {
      set({ isLoading: true, error: null });
      const response = await authAPI.updateProfile(data);
      if (response.data.success && response.data.data) {
        set({ user: response.data.data });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update profile';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchProfile: async () => {
    try {
      const response = await authAPI.getProfile();
      if (response.data.success && response.data.data) {
        set({ user: response.data.data });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch profile';
      set({ error: message });
    }
  },

  fetchEmergencyContacts: async () => {
    try {
      const response = await contactsAPI.getContacts();
      if (response.data.success && response.data.data) {
        set({ emergencyContacts: response.data.data });
      }
    } catch (err: unknown) {
      console.warn('Failed to fetch emergency contacts:', err);
    }
  },

  addEmergencyContact: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const response = await contactsAPI.addContact(data);
      if (response.data.success && response.data.data) {
        set((state) => ({
          emergencyContacts: [...state.emergencyContacts, response.data.data!],
        }));
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to add contact';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  removeEmergencyContact: async (contactId: string) => {
    try {
      set({ isLoading: true, error: null });
      await contactsAPI.deleteContact(contactId);
      set((state) => ({
        emergencyContacts: state.emergencyContacts.filter(
          (c) => c.contact_id !== contactId,
        ),
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to remove contact';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
