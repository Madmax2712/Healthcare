'use client';

import { useEffect, useState, useCallback } from 'react';
import PortalLayout from '@/components/layout/PortalLayout';
import OverviewCards from '@/components/dashboard/OverviewCards';
import SpecialistStatusList from '@/components/dashboard/SpecialistStatusList';
import RecentFeedback from '@/components/dashboard/RecentFeedback';
import { hospitalApi } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useSpecialists } from '@/hooks/useSpecialists';
import { useSocket } from '@/hooks/useSocket';
import type { DashboardStats, ApiResponse, AvailabilityStatus } from '@/types';

// ── Dashboard Page ──────────────────────────────────────────

export default function DashboardPage() {
  const hospitalId = useAuthStore((state) => state.hospitalId);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const {
    specialists,
    isLoading: specialistsLoading,
    updateStatus,
    handleRealtimeStatusUpdate,
    fetchSpecialists,
  } = useSpecialists({ autoFetch: true });

  // ── Fetch Dashboard Stats ──────────────────────────────────

  const fetchStats = useCallback(async () => {
    if (!hospitalId) return;

    setStatsLoading(true);
    setStatsError(null);

    try {
      const response = await hospitalApi.getDashboardStats(hospitalId);
      const data = response.data as ApiResponse<DashboardStats>;
      if (data.success && data.data) {
        setStats(data.data);
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load dashboard statistics.';
      setStatsError(message);
    } finally {
      setStatsLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ── WebSocket for Real-time Updates ────────────────────────

  useSocket({
    onSpecialistStatusChanged: (update) => {
      handleRealtimeStatusUpdate(update);
      // Refresh stats when a specialist status changes
      fetchStats();
    },
    onHospitalDataUpdated: () => {
      fetchStats();
      fetchSpecialists();
    },
  });

  // ── Status Update Handler ──────────────────────────────────

  const handleStatusUpdate = async (specialistId: string, status: AvailabilityStatus) => {
    const success = await updateStatus(specialistId, status);
    if (success) {
      fetchStats(); // Refresh stats after status change
    }
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-hg-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-hg-gray-500">
            Overview of your hospital operations and specialist activity.
          </p>
        </div>

        {/* Stats Error */}
        {statsError && (
          <div className="rounded-lg border border-hg-red-200 bg-hg-red-50 px-4 py-3">
            <p className="text-sm text-hg-red-700">{statsError}</p>
          </div>
        )}

        {/* Overview Cards */}
        <OverviewCards stats={stats} isLoading={statsLoading} />

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Left: Specialist Status List */}
          <SpecialistStatusList
            specialists={specialists}
            onStatusUpdate={handleStatusUpdate}
            isLoading={specialistsLoading}
          />

          {/* Right: Recent Feedback */}
          <RecentFeedback />
        </div>
      </div>
    </PortalLayout>
  );
}
