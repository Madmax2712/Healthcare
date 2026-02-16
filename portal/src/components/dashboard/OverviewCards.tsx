'use client';

import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import StatsCard from '@/components/ui/StatsCard';
import type { DashboardStats } from '@/types';

// ── Overview Cards Component ────────────────────────────────

interface OverviewCardsProps {
  stats: DashboardStats | null;
  isLoading?: boolean;
}

export default function OverviewCards({ stats, isLoading }: OverviewCardsProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border border-hg-gray-200 bg-white"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Specialists */}
      <StatsCard
        label="Total Specialists"
        value={stats.total_specialists}
        color="primary"
        icon={<UsersIcon className="h-6 w-6" />}
      />

      {/* On Duty / Available */}
      <StatsCard
        label="On Duty"
        value={stats.available_count}
        color="green"
        icon={<CheckCircleIcon className="h-6 w-6" />}
      />

      {/* Busy */}
      <StatsCard
        label="Busy"
        value={stats.busy_count}
        color="yellow"
        icon={<ClockIcon className="h-6 w-6" />}
      />

      {/* Off Duty */}
      <StatsCard
        label="Off Duty"
        value={stats.off_duty_count}
        color="red"
        icon={<XCircleIcon className="h-6 w-6" />}
      />
    </div>
  );
}
