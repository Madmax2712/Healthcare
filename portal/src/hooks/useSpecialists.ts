'use client';

import { useState, useCallback, useEffect } from 'react';
import { specialistApi } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';
import type {
  HospitalSpecialist,
  AvailabilityStatus,
  SpecialistFormData,
  ApiResponse,
  PaginationInfo,
  WSSpecialistUpdate,
} from '@/types';

// ── Types ───────────────────────────────────────────────────

interface UseSpecialistsOptions {
  autoFetch?: boolean;
  page?: number;
  limit?: number;
  search?: string;
  specialtyId?: string;
}

interface UseSpecialistsReturn {
  specialists: HospitalSpecialist[];
  pagination: PaginationInfo | null;
  isLoading: boolean;
  error: string | null;
  fetchSpecialists: () => Promise<void>;
  createSpecialist: (data: SpecialistFormData) => Promise<HospitalSpecialist | null>;
  updateSpecialist: (id: string, data: Partial<SpecialistFormData>) => Promise<HospitalSpecialist | null>;
  deleteSpecialist: (id: string) => Promise<boolean>;
  updateStatus: (id: string, status: AvailabilityStatus) => Promise<boolean>;
  handleRealtimeStatusUpdate: (update: WSSpecialistUpdate) => void;
}

// ── Hook ────────────────────────────────────────────────────

export function useSpecialists(options: UseSpecialistsOptions = {}): UseSpecialistsReturn {
  const {
    autoFetch = true,
    page = 1,
    limit = 20,
    search,
    specialtyId,
  } = options;

  const hospitalId = useAuthStore((state) => state.hospitalId);
  const [specialists, setSpecialists] = useState<HospitalSpecialist[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch All Specialists ─────────────────────────────

  const fetchSpecialists = useCallback(async () => {
    if (!hospitalId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await specialistApi.getAll(hospitalId, {
        page,
        limit,
        search: search || undefined,
        specialty_id: specialtyId || undefined,
      });

      const data = response.data as ApiResponse<HospitalSpecialist[]>;
      if (data.success && data.data) {
        setSpecialists(data.data);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load specialists.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [hospitalId, page, limit, search, specialtyId]);

  // ── Create Specialist ─────────────────────────────────

  const createSpecialist = useCallback(
    async (data: SpecialistFormData): Promise<HospitalSpecialist | null> => {
      if (!hospitalId) return null;

      try {
        const response = await specialistApi.create(hospitalId, {
          ...data,
          hospital_id: hospitalId,
          availability_status: 'off_duty' as AvailabilityStatus,
          is_available: false,
        });

        const result = response.data as ApiResponse<HospitalSpecialist>;
        if (result.success && result.data) {
          setSpecialists((prev) => [...prev, result.data!]);
          return result.data;
        }
        return null;
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Failed to create specialist.';
        setError(message);
        return null;
      }
    },
    [hospitalId]
  );

  // ── Update Specialist ─────────────────────────────────

  const updateSpecialist = useCallback(
    async (id: string, data: Partial<SpecialistFormData>): Promise<HospitalSpecialist | null> => {
      if (!hospitalId) return null;

      try {
        const response = await specialistApi.update(hospitalId, id, data);
        const result = response.data as ApiResponse<HospitalSpecialist>;

        if (result.success && result.data) {
          setSpecialists((prev) =>
            prev.map((s) => (s.specialist_id === id ? result.data! : s))
          );
          return result.data;
        }
        return null;
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Failed to update specialist.';
        setError(message);
        return null;
      }
    },
    [hospitalId]
  );

  // ── Delete Specialist ─────────────────────────────────

  const deleteSpecialist = useCallback(
    async (id: string): Promise<boolean> => {
      if (!hospitalId) return false;

      try {
        await specialistApi.delete(hospitalId, id);
        setSpecialists((prev) => prev.filter((s) => s.specialist_id !== id));
        return true;
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Failed to delete specialist.';
        setError(message);
        return false;
      }
    },
    [hospitalId]
  );

  // ── Update Status ─────────────────────────────────────

  const updateStatus = useCallback(
    async (id: string, status: AvailabilityStatus): Promise<boolean> => {
      if (!hospitalId) return false;

      try {
        await specialistApi.updateStatus(hospitalId, id, status);
        setSpecialists((prev) =>
          prev.map((s) =>
            s.specialist_id === id
              ? {
                  ...s,
                  availability_status: status,
                  is_available: status === 'available',
                }
              : s
          )
        );
        return true;
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Failed to update specialist status.';
        setError(message);
        return false;
      }
    },
    [hospitalId]
  );

  // ── Handle Realtime Updates ───────────────────────────

  const handleRealtimeStatusUpdate = useCallback((update: WSSpecialistUpdate) => {
    setSpecialists((prev) =>
      prev.map((s) =>
        s.specialist_id === update.specialist_id
          ? {
              ...s,
              availability_status: update.availability_status,
              is_available: update.availability_status === 'available',
              next_available_slot: update.next_available_slot || s.next_available_slot,
            }
          : s
      )
    );
  }, []);

  // ── Auto-fetch on mount ───────────────────────────────

  useEffect(() => {
    if (autoFetch && hospitalId) {
      fetchSpecialists();
    }
  }, [autoFetch, hospitalId, fetchSpecialists]);

  return {
    specialists,
    pagination,
    isLoading,
    error,
    fetchSpecialists,
    createSpecialist,
    updateSpecialist,
    deleteSpecialist,
    updateStatus,
    handleRealtimeStatusUpdate,
  };
}

export default useSpecialists;
