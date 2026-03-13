import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import { marketApi } from '../services/api'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import type { CandleData, TimeRange } from '../types'

const TIME_RANGES: { label: string; value: TimeRange; period: string; interval: string }[] = [
  { label: '1D', value: '1d', period: '1d', interval: '5m' },
  { label: '1W', value: '1w', period: '5d', interval: '30m' },
  { label: '1M', value: '1mo', period: '1mo', interval: '1d' },
  { label: '3M', value: '3mo', period: '3mo', interval: '1d' },
  { label: '6M', value: '6mo', period: '6mo', interval: '1d' },
  { label: '1Y', value: '1y', period: '1y', interval: '1wk' },
]

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: CandleData }>
  label?: string
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as CandleData
  const close = d.close
  const isPositive = close >= d.open

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-3 shadow-xl text-xs">
      <p className="text-gray-400 mb-1">{format(new Date(d.time), 'MMM d, yyyy HH:mm')}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-gray-500">Open</span>
        <span className="font-mono text-right">${d.open?.toFixed(2)}</span>
        <span className="text-gray-500">Close</span>
        <span className={clsx('font-mono text-right', isPositive ? 'text-brand-green' : 'text-accent-red')}>
          ${close?.toFixed(2)}
        </span>
        <span className="text-gray-500">High</span>
        <span className="font-mono text-right text-brand-green">${d.high?.toFixed(2)}</span>
        <span className="text-gray-500">Low</span>
        <span className="font-mono text-right text-accent-red">${d.low?.toFixed(2)}</span>
      </div>
    </div>
  )
}

interface Props {
  symbol: string
  currentPrice?: number
}

export default function StockChart({ symbol, currentPrice }: Props) {
  const [range, setRange] = useState<{ value: TimeRange; period: string; interval: string }>(TIME_RANGES[2])

  const { data: candles = [], isLoading } = useQuery({
    queryKey: ['history', symbol, range.period, range.interval],
    queryFn: () => marketApi.history(symbol, range.period, range.interval),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!candles.length) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No chart data available
      </div>
    )
  }

  const firstPrice = candles[0]?.close || 0
  const lastPrice = candles[candles.length - 1]?.close || 0
  const isPositive = lastPrice >= firstPrice
  const color = isPositive ? '#00C805' : '#FF5000'

  const minPrice = Math.min(...candles.map((c: CandleData) => c.low)) * 0.999
  const maxPrice = Math.max(...candles.map((c: CandleData) => c.high)) * 1.001

  const formatTime = (time: string) => {
    try {
      const d = new Date(time)
      if (range.interval === '5m' || range.interval === '30m') return format(d, 'HH:mm')
      if (range.interval === '1wk') return format(d, 'MMM d')
      return format(d, 'MMM d')
    } catch {
      return time
    }
  }

  return (
    <div className="space-y-3">
      {/* Time range selector */}
      <div className="flex gap-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r)}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
              range.value === r.value
                ? 'bg-dark-surface text-white'
                : 'text-gray-500 hover:text-gray-300'
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={candles} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          {currentPrice && (
            <ReferenceLine
              y={currentPrice}
              stroke={color}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          <Area
            type="monotone"
            dataKey="close"
            stroke={color}
            strokeWidth={2}
            fill="url(#chartGrad)"
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
