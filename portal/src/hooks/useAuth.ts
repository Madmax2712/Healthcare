'use client';

import { create } from 'zustand';
import { authApi, setAccessToken, clearTokens } from '@/lib/api';
import type { HospitalAdmin, AdminRole } from '@/types';

// ── Auth Store Types ────────────────────────────────────────

interface AuthStore {
  admin: HospitalAdmin | null;
  hospitalId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loadProfile: () => Promise<void>;
  clearError: () => void;
  hasRole: (role: AdminRole) => boolean;
  hasAnyRole: (roles: AdminRole[]) => boolean;
}

// ── Auth Store ──────────────────────────────────────────────

export const useAuthStore = create<AuthStore>((set, get) => ({
  admin: null,
  hospitalId: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email: string, password: string): Promise<boolean> => {
    set({ isLoading: true, error: null });

    try {
      const response = await authApi.login(email, password);
      const { access_token, refresh_token, admin } = response.data.data!;

      setAccessToken(access_token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('hg_refresh_token', refresh_token);
      }

      set({
        admin,
        hospitalId: admin.hospital_id,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Invalid email or password. Please try again.';

      set({
        admin: null,
        hospitalId: null,
        isAuthenticated: false,
        isLoading: false,
        error: message,
      });

      return false;
    }
  },

  logout: async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Continue logout even if API call fails
    } finally {
      clearTokens();
      set({
        admin: null,
        hospitalId: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  loadProfile: async (): Promise<void> => {
    set({ isLoading: true });

    try {
      const response = await authApi.getProfile();
      const admin = response.data.data!;

      set({
        admin,
        hospitalId: admin.hospital_id,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      clearTokens();
      set({
        admin: null,
        hospitalId: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),

  hasRole: (role: AdminRole): boolean => {
    const { admin } = get();
    return admin?.role === role;
  },

  hasAnyRole: (roles: AdminRole[]): boolean => {
    const { admin } = get();
    return admin ? roles.includes(admin.role) : false;
  },
}));

// ── Convenience Hook ────────────────────────────────────────

export function useAuth() {
  const store = useAuthStore();
  return store;
}

export default useAuth;
