'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  CalendarDaysIcon,
  ChartBarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import PortalLayout from '@/components/layout/PortalLayout';
import { analyticsApi } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';
import type {
  VisitTrendData,
  RatingTrendData,
  SpecialistUtilization,
  BusiestHourData,
  ApiResponse,
} from '@/types';

// ── Chart Colors ─────────────────────────────────────────────

const CHART_COLORS = {
  primary: '#1d6ef1',
  primaryLight: '#bce0ff',
  green: '#14d45b',
  yellow: '#eab308',
  red: '#ef4444',
  gray: '#94a3b8',
};

// ── Analytics Page ──────────────────────────────────────────

export default function AnalyticsPage() {
  const hospitalId = useAuthStore((state) => state.hospitalId);

  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Data states
  const [visitTrends, setVisitTrends] = useState<VisitTrendData[]>([]);
  const [ratingTrends, setRatingTrends] = useState<RatingTrendData[]>([]);
  const [utilization, setUtilization] = useState<SpecialistUtilization[]>([]);
  const [busiestHours, setBusiestHours] = useState<BusiestHourData[]>([]);

  // Loading states
  const [isLoadingVisits, setIsLoadingVisits] = useState(true);
  const [isLoadingRatings, setIsLoadingRatings] = useState(true);
  const [isLoadingUtilization, setIsLoadingUtilization] = useState(true);
  const [isLoadingBusiest, setIsLoadingBusiest] = useState(true);

  // ── Fetch Visit Trends ─────────────────────────────────────

  const fetchVisitTrends = useCallback(async () => {
    if (!hospitalId) return;
    setIsLoadingVisits(true);
    try {
      const response = await analyticsApi.getVisitTrends(hospitalId, {
        start_date: startDate,
        end_date: endDate,
      });
      const data = response.data as ApiResponse<VisitTrendData[]>;
      if (data.success && data.data) {
        setVisitTrends(data.data);
      }
    } catch {
      console.error('Failed to fetch visit trends');
    } finally {
      setIsLoadingVisits(false);
    }
  }, [hospitalId, startDate, endDate]);

  // ── Fetch Rating Trends ────────────────────────────────────

  const fetchRatingTrends = useCallback(async () => {
    if (!hospitalId) return;
    setIsLoadingRatings(true);
    try {
      const response = await analyticsApi.getRatingTrends(hospitalId, {
        start_date: startDate,
        end_date: endDate,
      });
      const data = response.data as ApiResponse<RatingTrendData[]>;
      if (data.success && data.data) {
        setRatingTrends(data.data);
      }
    } catch {
      console.error('Failed to fetch rating trends');
    } finally {
      setIsLoadingRatings(false);
    }
  }, [hospitalId, startDate, endDate]);

  // ── Fetch Utilization ──────────────────────────────────────

  const fetchUtilization = useCallback(async () => {
    if (!hospitalId) return;
    setIsLoadingUtilization(true);
    try {
      const response = await analyticsApi.getSpecialistUtilization(hospitalId);
      const data = response.data as ApiResponse<SpecialistUtilization[]>;
      if (data.success && data.data) {
        setUtilization(data.data);
      }
    } catch {
      console.error('Failed to fetch utilization data');
    } finally {
      setIsLoadingUtilization(false);
    }
  }, [hospitalId]);

  // ── Fetch Busiest Hours ────────────────────────────────────

  const fetchBusiestHours = useCallback(async () => {
    if (!hospitalId) return;
    setIsLoadingBusiest(true);
    try {
      const response = await analyticsApi.getBusiestHours(hospitalId);
      const data = response.data as ApiResponse<BusiestHourData[]>;
      if (data.success && data.data) {
        setBusiestHours(data.data);
      }
    } catch {
      console.error('Failed to fetch busiest hours');
    } finally {
      setIsLoadingBusiest(false);
    }
  }, [hospitalId]);

  // ── Initial Fetch ──────────────────────────────────────────

  useEffect(() => {
    fetchVisitTrends();
    fetchRatingTrends();
    fetchUtilization();
    fetchBusiestHours();
  }, [fetchVisitTrends, fetchRatingTrends, fetchUtilization, fetchBusiestHours]);

  // ── Refresh All ────────────────────────────────────────────

  const handleRefresh = () => {
    fetchVisitTrends();
    fetchRatingTrends();
    fetchUtilization();
    fetchBusiestHours();
  };

  // ── Format Hour ────────────────────────────────────────────

  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}${ampm}`;
  };

  // ── Format Date ────────────────────────────────────────────

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ── Loading Skeleton ───────────────────────────────────────

  const ChartSkeleton = () => (
    <div className="flex h-80 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-hg-primary-200 border-t-hg-primary-600" />
        <p className="text-sm text-hg-gray-400">Loading chart data...</p>
      </div>
    </div>
  );

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <ChartBarIcon className="h-7 w-7 text-hg-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-hg-gray-900">Analytics</h1>
              <p className="mt-1 text-sm text-hg-gray-500">
                Hospital performance metrics and trends.
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-hg-gray-300 bg-white px-4 py-2 text-sm font-medium text-hg-gray-700 shadow-sm transition-colors hover:bg-hg-gray-50"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Date Range Picker */}
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-hg-gray-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-sm text-hg-gray-600">
            <CalendarDaysIcon className="h-5 w-5 text-hg-gray-400" />
            <span className="font-medium">Date Range:</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-hg-gray-500">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 rounded-lg border border-hg-gray-300 px-3 py-2 text-sm text-hg-gray-900 focus:border-hg-primary-500 focus:outline-none focus:ring-2 focus:ring-hg-primary-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-hg-gray-500">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 rounded-lg border border-hg-gray-300 px-3 py-2 text-sm text-hg-gray-900 focus:border-hg-primary-500 focus:outline-none focus:ring-2 focus:ring-hg-primary-200"
            />
          </div>
          <button
            onClick={handleRefresh}
            className="rounded-lg bg-hg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-hg-primary-700"
          >
            Apply
          </button>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Visit Trends - Line Chart */}
          <div className="rounded-xl border border-hg-gray-200 bg-white p-6 shadow-card">
            <h3 className="text-base font-semibold text-hg-gray-900">Visit Trends</h3>
            <p className="mt-1 text-xs text-hg-gray-500">Daily patient visits over time</p>

            {isLoadingVisits ? (
              <ChartSkeleton />
            ) : visitTrends.length === 0 ? (
              <div className="flex h-80 items-center justify-center text-sm text-hg-gray-400">
                No visit data available for the selected period.
              </div>
            ) : (
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={visitTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip
                      labelFormatter={formatDate}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Visits"
                      stroke={CHART_COLORS.primary}
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS.primary, r: 3 }}
                      activeDot={{ r: 5, fill: CHART_COLORS.primary }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Rating Trends - Line Chart */}
          <div className="rounded-xl border border-hg-gray-200 bg-white p-6 shadow-card">
            <h3 className="text-base font-semibold text-hg-gray-900">Rating Trends</h3>
            <p className="mt-1 text-xs text-hg-gray-500">Average patient rating over time</p>

            {isLoadingRatings ? (
              <ChartSkeleton />
            ) : ratingTrends.length === 0 ? (
              <div className="flex h-80 items-center justify-center text-sm text-hg-gray-400">
                No rating data available for the selected period.
              </div>
            ) : (
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ratingTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      domain={[0, 5]}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip
                      labelFormatter={formatDate}
                      formatter={(value: number) => [value.toFixed(2), 'Avg Rating']}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="avg_rating"
                      name="Avg Rating"
                      stroke={CHART_COLORS.green}
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS.green, r: 3 }}
                      activeDot={{ r: 5, fill: CHART_COLORS.green }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Specialist Utilization - Bar Chart */}
          <div className="rounded-xl border border-hg-gray-200 bg-white p-6 shadow-card">
            <h3 className="text-base font-semibold text-hg-gray-900">Specialist Utilization</h3>
            <p className="mt-1 text-xs text-hg-gray-500">
              How busy each specialist is (by percentage)
            </p>

            {isLoadingUtilization ? (
              <ChartSkeleton />
            ) : utilization.length === 0 ? (
              <div className="flex h-80 items-center justify-center text-sm text-hg-gray-400">
                No utilization data available.
              </div>
            ) : (
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={utilization}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="doctor_name"
                      width={120}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Utilization']}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="utilization_pct"
                      name="Utilization %"
                      fill={CHART_COLORS.primary}
                      radius={[0, 4, 4, 0]}
                      barSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Busiest Hours - Bar Chart */}
          <div className="rounded-xl border border-hg-gray-200 bg-white p-6 shadow-card">
            <h3 className="text-base font-semibold text-hg-gray-900">Busiest Hours</h3>
            <p className="mt-1 text-xs text-hg-gray-500">
              Average patient visits by hour of the day
            </p>

            {isLoadingBusiest ? (
              <ChartSkeleton />
            ) : busiestHours.length === 0 ? (
              <div className="flex h-80 items-center justify-center text-sm text-hg-gray-400">
                No hourly data available.
              </div>
            ) : (
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={busiestHours}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={formatHour}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip
                      labelFormatter={formatHour}
                      formatter={(value: number) => [value.toFixed(1), 'Avg Visits']}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="avg_visits"
                      name="Avg Visits"
                      fill={CHART_COLORS.yellow}
                      radius={[4, 4, 0, 0]}
                      barSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
