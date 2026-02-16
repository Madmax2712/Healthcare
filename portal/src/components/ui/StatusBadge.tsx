import type { AvailabilityStatus } from '@/types';

// ── Status Badge Component ──────────────────────────────────

interface StatusBadgeProps {
  status: AvailabilityStatus;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

const statusConfig: Record<
  AvailabilityStatus,
  { label: string; bgColor: string; textColor: string; dotColor: string }
> = {
  available: {
    label: 'Available',
    bgColor: 'bg-hg-green-50',
    textColor: 'text-hg-green-700',
    dotColor: 'bg-hg-green-500',
  },
  busy: {
    label: 'Busy',
    bgColor: 'bg-hg-yellow-50',
    textColor: 'text-hg-yellow-700',
    dotColor: 'bg-hg-yellow-500',
  },
  off_duty: {
    label: 'Off Duty',
    bgColor: 'bg-hg-red-50',
    textColor: 'text-hg-red-700',
    dotColor: 'bg-hg-red-500',
  },
};

const sizeClasses: Record<string, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export default function StatusBadge({
  status,
  size = 'md',
  showDot = true,
  className = '',
}: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        ${config.bgColor} ${config.textColor} ${sizeClasses[size]}
        ${className}
      `}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${config.dotColor} ${
            status === 'available' ? 'animate-pulse-slow' : ''
          }`}
        />
      )}
      {config.label}
    </span>
  );
}
