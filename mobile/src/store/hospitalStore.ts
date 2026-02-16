// ============================================================
// HealthGuard Mobile - Hospital Store (Zustand)
// ============================================================

import { create } from 'zustand';
import type {
  Hospital,
  Specialty,
  HospitalSpecialist,
  HospitalSearchParams,
  LocationCoordinates,
} from '../../shared/types';
import { DEFAULT_SEARCH_RADIUS_MILES } from '../../shared/constants';
import { hospitalAPI } from '../api/endpoints';

interface HospitalState {
  // Data
  hospitals: Hospital[];
  selectedHospital: Hospital | null;
  specialists: HospitalSpecialist[];
  specialties: Specialty[];
  nearestER: Hospital | null;

  // Filters
  selectedSpecialtyId: string | null;
  searchQuery: string;
  showAvailableOnly: boolean;
  showEmergencyOnly: boolean;

  // UI state
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;

  // Actions
  searchHospitals: (location: LocationCoordinates) => Promise<void>;
  fetchHospital: (hospitalId: string) => Promise<void>;
  fetchSpecialties: () => Promise<void>;
  fetchHospitalSpecialists: (hospitalId: string) => Promise<void>;
  findNearestER: (location: LocationCoordinates) => Promise<void>;

  // Filter actions
  setSelectedSpecialty: (specialtyId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setShowAvailableOnly: (value: boolean) => void;
  setShowEmergencyOnly: (value: boolean) => void;
  clearFilters: () => void;

  // Helpers
  selectHospital: (hospital: Hospital | null) => void;
  updateSpecialistStatus: (
    specialistId: string,
    status: HospitalSpecialist['availability_status'],
  ) => void;
  clearError: () => void;
}

export const useHospitalStore = create<HospitalState>((set, get) => ({
  hospitals: [],
  selectedHospital: null,
  specialists: [],
  specialties: [],
  nearestER: null,
  selectedSpecialtyId: null,
  searchQuery: '',
  showAvailableOnly: false,
  showEmergencyOnly: false,
  isLoading: false,
  isSearching: false,
  error: null,

  searchHospitals: async (location: LocationCoordinates) => {
    try {
      set({ isSearching: true, error: null });
      const { selectedSpecialtyId, showAvailableOnly, showEmergencyOnly } = get();

      const params: HospitalSearchParams = {
        latitude: location.latitude,
        longitude: location.longitude,
        radius_miles: DEFAULT_SEARCH_RADIUS_MILES,
        specialty_id: selectedSpecialtyId || undefined,
        available_now: showAvailableOnly || undefined,
        emergency_only: showEmergencyOnly || undefined,
      };

      const response = await hospitalAPI.searchHospitals(params);
      if (response.data.success && response.data.data) {
        set({ hospitals: response.data.data });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to search hospitals';
      set({ error: message });
    } finally {
      set({ isSearching: false });
    }
  },

  fetchHospital: async (hospitalId: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await hospitalAPI.getHospital(hospitalId);
      if (response.data.success && response.data.data) {
        set({ selectedHospital: response.data.data });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch hospital details';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSpecialties: async () => {
    try {
      const response = await hospitalAPI.getSpecialties();
      if (response.data.success && response.data.data) {
        set({ specialties: response.data.data });
      }
    } catch (err: unknown) {
      console.warn('Failed to fetch specialties:', err);
    }
  },

  fetchHospitalSpecialists: async (hospitalId: string) => {
    try {
      set({ isLoading: true, error: null });
      const { selectedSpecialtyId } = get();
      const response = await hospitalAPI.getHospitalSpecialists(hospitalId, {
        specialty_id: selectedSpecialtyId || undefined,
      });
      if (response.data.success && response.data.data) {
        set({ specialists: response.data.data });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch specialists';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  findNearestER: async (location: LocationCoordinates) => {
    try {
      set({ isLoading: true, error: null });
      const response = await hospitalAPI.getNearestER(location);
      if (response.data.success && response.data.data) {
        set({ nearestER: response.data.data });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to find nearest ER';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  setSelectedSpecialty: (specialtyId: string | null) => {
    set({ selectedSpecialtyId: specialtyId });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setShowAvailableOnly: (value: boolean) => {
    set({ showAvailableOnly: value });
  },

  setShowEmergencyOnly: (value: boolean) => {
    set({ showEmergencyOnly: value });
  },

  clearFilters: () => {
    set({
      selectedSpecialtyId: null,
      searchQuery: '',
      showAvailableOnly: false,
      showEmergencyOnly: false,
    });
  },

  selectHospital: (hospital: Hospital | null) => {
    set({ selectedHospital: hospital, specialists: [] });
  },

  updateSpecialistStatus: (specialistId, status) => {
    set((state) => ({
      specialists: state.specialists.map((s) =>
        s.specialist_id === specialistId
          ? { ...s, availability_status: status, is_available: status === 'available' }
          : s,
      ),
    }));
  },

  clearError: () => set({ error: null }),
}));
