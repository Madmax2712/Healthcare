import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  Zap, TrendingUp, TrendingDown, RefreshCw, Clock,
  Target, Shield, BarChart2, AlertCircle, ChevronDown, ChevronUp, Calendar
} from 'lucide-react'
import { autoTraderApi, marketApi } from '../services/api'
import { useMarketStore } from '../store'

type MarketFilter = 'ALL' | 'US' | 'INDIA' | 'CRYPTO'

function ActionBadge({ action }: { action: string }) {
  if (action === 'BUY')
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/15 text-green-400 border border-green-500/30">BUY</span>
  if (action === 'SELL')
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">SELL</span>
  return <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-500/15 text-gray-400 border border-gray-500/20">HOLD</span>
}

function ConfBar({ value }: { value: number }) {
  const pct = Math.min(value * 100, 100)
  const color = pct >= 80 ? 'bg-green-400' : pct >= 65 ? 'bg-yellow-400' : 'bg-gray-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[#21262d] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 tabular-nums">{pct.toFixed(0)}%</span>
    </div>
  )
}

function SignalRow({ sig, livePrice }: { sig: any; livePrice?: number }) {
  const [expanded, setExpanded] = useState(false)
  const price = livePrice ?? sig.price ?? 0
  const isBuy = sig.action === 'BUY'
  const isSell = sig.action === 'SELL'

  return (
    <>
      <tr
        className={clsx(
          'border-b border-[#21262d] hover:bg-[#161b22] transition-colors cursor-pointer',
          isBuy && 'bg-green-500/2',
          isSell && 'bg-red-500/2',
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Symbol */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <ActionBadge action={sig.action} />
            <span className="font-mono font-bold text-white text-sm">{sig.symbol}</span>
            <span className="text-xs text-gray-600">{sig.market}</span>
          </div>
        </td>

        {/* Price */}
        <td className="px-4 py-3 text-right font-mono">
          <span className="text-white text-sm">${price >= 1 ? price.toLocaleString('en', { maximumFractionDigits: 2 }) : price.toFixed(4)}</span>
          {sig.change_pct !== 0 && (
            <span className={clsx('ml-2 text-xs', sig.change_pct >= 0 ? 'text-green-400' : 'text-red-400')}>
              {sig.change_pct >= 0 ? '+' : ''}{sig.change_pct?.toFixed(2)}%
            </span>
          )}
        </td>

        {/* Confidence */}
        <td className="px-4 py-3">
          <ConfBar value={sig.confidence} />
        </td>

        {/* Target */}
        <td className="px-4 py-3 text-right font-mono text-xs">
          <span className="text-green-400">${sig.target_price?.toFixed(2) ?? '—'}</span>
        </td>

        {/* Stop */}
        <td className="px-4 py-3 text-right font-mono text-xs">
          <span className="text-red-400">${sig.stop_loss?.toFixed(2) ?? '—'}</span>
        </td>

        {/* Expected return */}
        <td className="px-4 py-3 text-right font-mono text-xs">
          {sig.expected_return_pct ? (
            <span className={sig.expected_return_pct >= 0 ? 'text-green-400' : 'text-red-400'}>
              {sig.expected_return_pct >= 0 ? '+' : ''}{sig.expected_return_pct?.toFixed(1)}%
            </span>
          ) : '—'}
        </td>

        {/* R/R */}
        <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">
          {sig.risk_reward ? `${sig.risk_reward?.toFixed(1)}:1` : '—'}
        </td>

        {/* Hold period */}
        <td className="px-4 py-3 text-center">
          {sig.hold_days || sig.hold_period_days ? (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-mono text-yellow-400">
                {sig.hold_days || sig.hold_period_days}d
              </span>
              {sig.exit_date && (
                <span className="text-xs text-gray-600">
                  exit {sig.exit_date?.slice(5)}
                </span>
              )}
            </div>
          ) : '—'}
        </td>

        {/* Source */}
        <td className="px-4 py-3 text-center">
          <span className={clsx('text-xs px-1.5 py-0.5 rounded',
            sig.source === 'ai_7layer' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
          )}>
            {sig.source === 'ai_7layer' ? 'AI' : 'Scan'}
          </span>
        </td>

        {/* Expand */}
        <td className="px-3 py-3 text-gray-500">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>

      {/* Expanded: dates + reasoning */}
      {expanded && (
        <tr className="bg-[#0d1117] border-b border-[#21262d]">
          <td colSpan={10} className="px-6 py-3 space-y-2">
            {(sig.entry_date || sig.exit_date) && (
              <div className="flex gap-6 text-xs">
                <span className="text-gray-500">Enter: <span className="text-white font-mono">{sig.entry_date || '—'}</span></span>
                <span className="text-gray-500">Exit by: <span className="text-yellow-400 font-mono">{sig.exit_date || '—'}</span></span>
                {(sig.hold_days || sig.hold_period_days) && (
                  <span className="text-gray-500">Hold: <span className="text-yellow-400 font-mono">{sig.hold_days || sig.hold_period_days} days</span></span>
                )}
              </div>
            )}
            {sig.reasoning && (
              <p className="text-xs text-gray-400 leading-relaxed">{sig.reasoning}</p>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function OptionCard({ opt }: { opt: any }) {
  const isCall = opt.option_type === 'CALL'
  return (
    <div className={clsx(
      'rounded-xl border p-4 space-y-3',
      isCall ? 'border-green-500/20 bg-green-500/3' : 'border-red-500/20 bg-red-500/3'
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={clsx(
            'px-2 py-0.5 rounded text-xs font-bold',
            isCall ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
          )}>
            {opt.option_type}
          </span>
          <span className="font-mono font-bold text-white">{opt.symbol}</span>
        </div>
        <span className="text-xs text-gray-500">{opt.confidence >= 0 ? `${(opt.confidence * 100).toFixed(0)}% conf` : ''}</span>
      </div>

      <div className="text-xs text-gray-400">{opt.strategy} · {opt.expiry_days}-day expiry</div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-[#0d1117] rounded p-2">
          <p className="text-gray-500">Underlying</p>
          <p className="font-mono text-white">${opt.underlying_price?.toFixed(2)}</p>
        </div>
        <div className="bg-[#0d1117] rounded p-2">
          <p className="text-gray-500">Strike</p>
          <p className="font-mono text-white">${opt.strike?.toFixed(2)}</p>
        </div>
        <div className="bg-[#0d1117] rounded p-2">
          <p className="text-gray-500">Est. Premium</p>
          <p className="font-mono text-yellow-400">${opt.est_premium?.toFixed(2)} ({opt.est_premium_pct}%)</p>
        </div>
        <div className="bg-[#0d1117] rounded p-2">
          <p className="text-gray-500">Expected Return</p>
          <p className="font-mono text-green-400">+{opt.expected_return_pct?.toFixed(1)}%</p>
        </div>
      </div>

      <div className="text-xs space-y-0.5">
        <p className="text-gray-500">Max Gain: <span className="text-green-400">{opt.max_gain}</span></p>
        <p className="text-gray-500">Max Loss: <span className="text-red-400">{opt.max_loss}</span></p>
      </div>

      <p className="text-xs text-gray-500 italic">{opt.reasoning}</p>
    </div>
  )
}

export default function LiveSignals() {
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('ALL')
  const [actionFilter, setActionFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL')
  const [countdown, setCountdown] = useState(30)
  const liveQuotes = useMarketStore((s) => s.liveQuotes)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['live-signals'],
    queryFn: () => autoTraderApi.liveSignals(),
    refetchInterval: 30_000,
    staleTime: 20_000,
  })

  // Countdown timer
  useEffect(() => {
    setCountdown(30)
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { return 30 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [data])

  const signals: any[] = data?.signals ?? []
  const options: any[] = data?.options ?? []

  const filtered = signals.filter((s) => {
    if (marketFilter !== 'ALL' && s.market !== marketFilter) return false
    if (actionFilter !== 'ALL' && s.action !== actionFilter) return false
    return true
  })

  const buyCount  = signals.filter(s => s.action === 'BUY').length
  const sellCount = signals.filter(s => s.action === 'SELL').length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-white">
            <Zap className="text-yellow-400" size={22} />
            Live Trade Signals
          </h1>
          <p className="text-gray-500 text-sm">Real-time AI buy/sell recommendations — updated every 30 seconds</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock size={13} />
            <span>Refresh in {countdown}s</span>
          </div>
          <button
            onClick={() => { refetch(); setCountdown(30) }}
            disabled={isFetching}
            className="btn-secondary text-sm py-1.5 flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Signals', value: signals.length, color: 'text-white', sub: 'from AI + scanner' },
          { label: 'BUY Signals', value: buyCount, color: 'text-green-400', sub: 'go long' },
          { label: 'SELL Signals', value: sellCount, color: 'text-red-400', sub: 'go short / exit' },
          { label: 'Options Plays', value: options.length, color: 'text-yellow-400', sub: 'calls & puts' },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="bg-[#0d1117] border border-[#21262d] rounded-xl p-4">
            <p className="text-gray-500 text-xs">{label}</p>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
            <p className="text-gray-600 text-xs">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1">
          {(['ALL', 'US', 'INDIA', 'CRYPTO'] as MarketFilter[]).map((m) => (
            <button
              key={m}
              onClick={() => setMarketFilter(m)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                marketFilter === m
                  ? 'bg-brand-green/15 text-brand-green border border-brand-green/30'
                  : 'text-gray-400 hover:text-white bg-[#161b22] border border-[#30363d]'
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['ALL', 'BUY', 'SELL'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setActionFilter(a)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                actionFilter === a
                  ? a === 'BUY' ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                    : a === 'SELL' ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : 'bg-brand-green/15 text-brand-green border border-brand-green/30'
                  : 'text-gray-400 hover:text-white bg-[#161b22] border border-[#30363d]'
              )}
            >
              {a}
            </button>
          ))}
        </div>
        {data?.last_updated && (
          <span className="text-xs text-gray-600 ml-auto">
            Last updated: {new Date(data.last_updated).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Signals Table */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#21262d] flex items-center gap-2">
          <TrendingUp size={15} className="text-brand-green" />
          <span className="text-sm font-semibold text-white">Trade Recommendations</span>
          <span className="text-xs text-gray-500">({filtered.length} signals)</span>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-600">
            <AlertCircle size={12} />
            Click a row to see AI reasoning
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" />
            Fetching live signals...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2">
            <Zap size={24} className="text-gray-700" />
            <p className="text-sm">No {actionFilter !== 'ALL' ? actionFilter : ''} signals yet — scanner is running</p>
            <p className="text-xs text-gray-600">The AI system continuously scans for opportunities</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-[#21262d]">
                  <th className="px-4 py-2.5 text-left">Symbol / Action</th>
                  <th className="px-4 py-2.5 text-right">Live Price</th>
                  <th className="px-4 py-2.5 text-left">Confidence</th>
                  <th className="px-4 py-2.5 text-right flex items-center gap-1 justify-end">
                    <Target size={11} /> Target
                  </th>
                  <th className="px-4 py-2.5 text-right">
                    <Shield size={11} className="inline mr-1" />Stop
                  </th>
                  <th className="px-4 py-2.5 text-right">Exp. Return</th>
                  <th className="px-4 py-2.5 text-right">R/R</th>
                  <th className="px-4 py-2.5 text-center">
                    <Calendar size={11} className="inline mr-1" />Hold
                  </th>
                  <th className="px-4 py-2.5 text-center">Source</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((sig) => (
                  <SignalRow
                    key={sig.symbol}
                    sig={sig}
                    livePrice={liveQuotes[sig.symbol]?.price}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Options Recommendations */}
      {options.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} className="text-yellow-400" />
            <h2 className="text-base font-bold text-white">Options Recommendations</h2>
            <span className="text-xs text-gray-500">Based on high-confidence signals</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {options
              .filter(o => marketFilter === 'ALL' || o.market === marketFilter)
              .map((opt, i) => <OptionCard key={`${opt.symbol}-${i}`} opt={opt} />)
            }
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-xs text-gray-500 leading-relaxed">
        <strong className="text-yellow-400">Disclaimer:</strong> These are AI-generated signals for informational purposes only.
        Options involve significant risk and are not suitable for all investors. Past performance does not guarantee future results.
        Options premiums shown are estimates — actual market prices will vary. Always conduct your own research before trading.
      </div>
    </div>
  )
}
