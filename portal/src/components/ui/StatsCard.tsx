import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';

// ── Stats Card Component ────────────────────────────────────

interface StatsCardProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  color?: 'primary' | 'green' | 'yellow' | 'red' | 'gray';
  className?: string;
}

const colorMap = {
  primary: {
    iconBg: 'bg-hg-primary-100',
    iconColor: 'text-hg-primary-600',
  },
  green: {
    iconBg: 'bg-hg-green-100',
    iconColor: 'text-hg-green-600',
  },
  yellow: {
    iconBg: 'bg-hg-yellow-100',
    iconColor: 'text-hg-yellow-600',
  },
  red: {
    iconBg: 'bg-hg-red-100',
    iconColor: 'text-hg-red-600',
  },
  gray: {
    iconBg: 'bg-hg-gray-100',
    iconColor: 'text-hg-gray-600',
  },
};

export default function StatsCard({
  label,
  value,
  icon,
  trend,
  color = 'primary',
  className = '',
}: StatsCardProps) {
  const colors = colorMap[color];

  return (
    <div
      className={`rounded-xl border border-hg-gray-200 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-hg-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-hg-gray-900">{value}</p>

          {/* Trend Indicator */}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              {trend.isPositive ? (
                <ArrowTrendingUpIcon className="h-4 w-4 text-hg-green-500" />
              ) : (
                <ArrowTrendingDownIcon className="h-4 w-4 text-hg-red-500" />
              )}
              <span
                className={`text-xs font-medium ${
                  trend.isPositive ? 'text-hg-green-600' : 'text-hg-red-600'
                }`}
              >
                {trend.isPositive ? '+' : ''}
                {trend.value}%
              </span>
              {trend.label && (
                <span className="text-xs text-hg-gray-400">{trend.label}</span>
              )}
            </div>
          )}
        </div>

        {/* Icon */}
        {icon && (
          <div
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${colors.iconBg}`}
          >
            <div className={colors.iconColor}>{icon}</div>
          </div>
        )}
      </div>
    </div>
  );
}
