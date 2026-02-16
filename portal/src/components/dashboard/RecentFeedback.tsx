'use client';

import { useEffect, useState } from 'react';
import { StarIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid';
import { feedbackApi } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';
import type { VisitFeedback, FeedbackStats, ApiResponse } from '@/types';

// ── Recent Feedback Component ───────────────────────────────

export default function RecentFeedback() {
  const hospitalId = useAuthStore((state) => state.hospitalId);
  const [feedback, setFeedback] = useState<VisitFeedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!hospitalId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [feedbackRes, statsRes] = await Promise.all([
          feedbackApi.getRecent(hospitalId, { limit: 5 }),
          feedbackApi.getStats(hospitalId),
        ]);

        const feedbackData = feedbackRes.data as ApiResponse<VisitFeedback[]>;
        const statsData = statsRes.data as ApiResponse<FeedbackStats>;

        if (feedbackData.success && feedbackData.data) {
          setFeedback(feedbackData.data);
        }
        if (statsData.success && statsData.data) {
          setStats(statsData.data);
        }
      } catch (err) {
        console.error('Failed to load feedback:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [hospitalId]);

  // ── Stars Renderer ────────────────────────────────────

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon
            key={i}
            className={`h-4 w-4 ${
              i < rating ? 'text-hg-yellow-400' : 'text-hg-gray-200'
            }`}
          />
        ))}
      </div>
    );
  };

  // ── Loading State ─────────────────────────────────────

  if (isLoading) {
    return (
      <div className="rounded-xl border border-hg-gray-200 bg-white shadow-card">
        <div className="border-b border-hg-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-hg-gray-900">Recent Patient Feedback</h3>
        </div>
        <div className="animate-pulse p-5">
          <div className="h-24 rounded-lg bg-hg-gray-100" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-hg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-hg-gray-200 bg-white shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hg-gray-200 px-5 py-4">
        <h3 className="text-base font-semibold text-hg-gray-900">
          Recent Patient Feedback
        </h3>
        <ChatBubbleLeftRightIcon className="h-5 w-5 text-hg-gray-400" />
      </div>

      {/* Average Rating Summary */}
      {stats && (
        <div className="border-b border-hg-gray-100 bg-hg-gray-50 px-5 py-4">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-hg-gray-900">
                {stats.avg_rating.toFixed(1)}
              </p>
              <div className="mt-1">{renderStars(Math.round(stats.avg_rating))}</div>
              <p className="mt-1 text-xs text-hg-gray-500">
                {stats.total_feedback} reviews
              </p>
            </div>

            <div className="flex-1 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-hg-gray-500">Wait Time</span>
                <span className="font-medium text-hg-gray-700">
                  {stats.avg_wait_time_rating.toFixed(1)}/5
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-hg-gray-500">Staff</span>
                <span className="font-medium text-hg-gray-700">
                  {stats.avg_staff_rating.toFixed(1)}/5
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-hg-gray-500">Facility</span>
                <span className="font-medium text-hg-gray-700">
                  {stats.avg_facility_rating.toFixed(1)}/5
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-hg-gray-500">Would Recommend</span>
                <span className="font-medium text-hg-green-600">
                  {stats.would_recommend_pct.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Comments */}
      <div className="max-h-[320px] divide-y divide-hg-gray-100 overflow-y-auto">
        {feedback.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-hg-gray-500">
            No feedback received yet.
          </div>
        ) : (
          feedback.map((item) => (
            <div key={item.feedback_id} className="px-5 py-3.5">
              <div className="flex items-center justify-between">
                {renderStars(item.rating)}
                <span className="text-xs text-hg-gray-400">
                  {new Date(item.submitted_at).toLocaleDateString()}
                </span>
              </div>
              {item.comments && (
                <p className="mt-1.5 text-sm text-hg-gray-600 line-clamp-2">
                  {item.comments}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                {item.would_recommend && (
                  <span className="text-xs text-hg-green-600">Would recommend</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
