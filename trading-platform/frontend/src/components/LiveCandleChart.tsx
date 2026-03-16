import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useMarketStore } from '../store'
import { marketApi } from '../services/api'

type Period = '1D' | '5D' | '1M' | '3M' | '1Y'

const PERIOD_MAP: Record<Period, { period: string; interval: string }> = {
  '1D': { period: '1d',  interval: '5m' },
  '5D': { period: '5d',  interval: '30m' },
  '1M': { period: '1mo', interval: '1d' },
  '3M': { period: '3mo', interval: '1d' },
  '1Y': { period: '1y',  interval: '1wk' },
}

interface ChartPoint {
  time: string
  price: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as ChartPoint
  if (!d) return null
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded p-2 text-xs">
      <p className="text-gray-400 mb-1">{d.time}</p>
      <p className="text-white font-mono">O: ${d.open?.toFixed(2)} H: ${d.high?.toFixed(2)}</p>
      <p className="text-white font-mono">L: ${d.low?.toFixed(2)} C: ${d.close?.toFixed(2)}</p>
      <p className="text-gray-400">Vol: {d.volume?.toLocaleString()}</p>
    </div>
  )
}

export default function LiveCandleChart() {
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol)
  const liveQuotes = useMarketStore((s) => s.liveQuotes)
  const priceHistory = useMarketStore((s) => s.priceHistory)
  const [period, setPeriod] = useState<Period>('3M')
  const [historicalData, setHistoricalData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(false)

  const quote = liveQuotes[selectedSymbol]
  const currentPrice = quote?.price ?? 0
  const changePct = quote?.change_pct ?? 0
  const isUp = changePct >= 0

  const fetchHistory = useCallback(async () => {
    if (!selectedSymbol) return
    setLoading(true)
    try {
      const { period: p, interval: iv } = PERIOD_MAP[period]
      const data = await marketApi.history(selectedSymbol, p, iv)
      const pts: ChartPoint[] = (data.data || []).map((d: any) => ({
        time: new Date(d.time).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        price: d.close,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
      }))
      setHistoricalData(pts)
    } catch {
      // fallback to live price history
    } finally {
      setLoading(false)
    }
  }, [selectedSymbol, period])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  // For 1D, use live tick data
  const chartData: ChartPoint[] = period === '1D' && priceHistory[selectedSymbol]?.length > 2
    ? priceHistory[selectedSymbol].map((p, i) => ({
        time: `T+${i}s`,
        price: p, open: p, high: p, low: p, close: p, volume: 0,
      }))
    : historicalData

  const basePrice = chartData[0]?.price ?? currentPrice
  const priceMin = Math.min(...chartData.map(d => d.price)) * 0.998
  const priceMax = Math.max(...chartData.map(d => d.price)) * 1.002

  const PERIODS: Period[] = ['1D', '5D', '1M', '3M', '1Y']

  return (
    <div className="flex-1 bg-[#0d1117] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-bold text-white font-mono">
              {currentPrice >= 10000
                ? `$${currentPrice.toLocaleString('en', { maximumFractionDigits: 0 })}`
                : `$${currentPrice.toFixed(2)}`}
            </h2>
            <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
              isUp ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {isUp ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          </div>
          <p className="text-gray-500 text-xs mt-0.5">
            {selectedSymbol} · {quote?.name ?? ''} · Live
          </p>
        </div>

        {/* Period selector */}
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-[#21262d]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">Loading chart...</div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">No chart data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#4b5563' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[priceMin, priceMax]}
                tick={{ fontSize: 10, fill: '#4b5563' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v >= 10000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0)}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} />
              {basePrice > 0 && (
                <ReferenceLine
                  y={basePrice}
                  stroke="#374151"
                  strokeDasharray="3 3"
                />
              )}
              <Area
                type="monotone"
                dataKey="price"
                stroke={isUp ? '#22c55e' : '#ef4444'}
                strokeWidth={1.5}
                fill="url(#chartGrad)"
                dot={false}
                activeDot={{ r: 3, fill: isUp ? '#22c55e' : '#ef4444' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
