/**
 * Options Trading Terminal
 *
 * Bloomberg-style options terminal showing:
 *  - Auto-simulated positions (AI manages these automatically)
 *  - Full options signal stream for all market stocks
 *  - CALL/PUT recommendations with Black-Scholes pricing + Greeks
 *  - Sortable by profit margin, confidence, IV
 *  - Mirror instructions for real-life replication
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  TrendingUp, TrendingDown, RefreshCw, Play, X, ArrowUpRight,
  ArrowDownRight, Activity, Target, ShieldAlert, Zap, BarChart2,
  ChevronUp, ChevronDown, Filter, Copy, CheckCircle, Bot, Radio
} from 'lucide-react'
import { clsx } from 'clsx'
import { optionsApi } from '../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface OptionsSignal {
  symbol: string
  market: string
  option_type: 'CALL' | 'PUT'
  strategy: string
  strike: number
  expiry_days: number
  expiry_date: string
  entry_premium: number
  target_premium: number
  underlying_price: number
  underlying_target: number
  underlying_action: string
  iv: number
  confidence: number
  expected_option_return_pct: number
  max_loss_per_contract: number
  max_gain_estimate: number
  margin_of_safety_pct: number
  contracts_for_500: number
  notional: number
  delta: number
  gamma: number
  theta: number
  vega: number
  entry_date: string
  exit_date: string
  reasoning: string
  mirror_instruction: string
}

interface AutoPosition {
  id: string
  symbol: string
  market: string
  option_type: 'CALL' | 'PUT'
  strategy: string
  strike: number
  expiry_date: string
  entry_premium: number
  target_premium: number
  current_premium: number
  contracts: number
  notional: number
  underlying_entry: number
  underlying_target: number
  iv: number
  confidence: number
  delta: number
  gamma: number
  theta: number
  vega: number
  pnl: number
  pnl_pct: number
  status: 'open' | 'closed'
  exit_reason?: string
  exit_premium?: number
  days_remaining: number
  reasoning: string
  mirror_instruction: string
  entry_time: string
}

interface Stats {
  open_count: number
  closed_count: number
  win_count: number
  loss_count: number
  win_rate: number
  total_realized_pnl: number
  open_unrealized_pnl: number
  best_trade: number
  worst_trade: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pnlColor = (v: number) =>
  v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-gray-400'
const pnlBg = (v: number) =>
  v > 0 ? 'bg-green-400/10 border-green-500/20'
         : v < 0 ? 'bg-red-400/10 border-red-500/20'
         : 'bg-gray-700/30 border-gray-600/20'
const sign = (v: number) => (v >= 0 ? '+' : '')

function ConfBar({ v }: { v: number }) {
  const pct = Math.round(v * 100)
  const color = pct >= 75 ? '#22c55e' : pct >= 60 ? '#eab308' : '#f97316'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 rounded-full bg-gray-700 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{pct}%</span>
    </div>
  )
}

function GreekBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={clsx('px-1.5 py-0.5 rounded text-xs font-mono', color)}>
      {label} {value > 0 ? '+' : ''}{value.toFixed(3)}
    </span>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="ml-1 text-gray-500 hover:text-brand-green transition-colors"
      title="Copy mirror instruction"
    >
      {copied ? <CheckCircle size={11} className="text-green-400" /> : <Copy size={11} />}
    </button>
  )
}

// ─── Signal Row ───────────────────────────────────────────────────────────────
function SignalRow({ sig, onSimulate }: { sig: OptionsSignal; onSimulate: (s: OptionsSignal) => void }) {
  const [expanded, setExpanded] = useState(false)
  const isCall = sig.option_type === 'CALL'

  return (
    <>
      <tr
        className="border-b border-[#21262d] hover:bg-[#161b22] cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Symbol + type */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className={clsx(
              'text-xs font-bold px-1.5 py-0.5 rounded',
              isCall ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            )}>
              {sig.option_type}
            </span>
            <div>
              <div className="text-sm font-semibold text-white">{sig.symbol}</div>
              <div className="text-xs text-gray-500">{sig.market}</div>
            </div>
          </div>
        </td>

        {/* Strike / Expiry */}
        <td className="px-3 py-2.5 text-sm font-mono">
          <div className="text-white">${sig.strike.toFixed(1)}</div>
          <div className="text-xs text-gray-500">{sig.expiry_days}d exp</div>
        </td>

        {/* Premium */}
        <td className="px-3 py-2.5 font-mono text-sm">
          <div className="text-white">${sig.entry_premium.toFixed(2)}</div>
          <div className="text-xs text-green-400">→ ${sig.target_premium.toFixed(2)}</div>
        </td>

        {/* Expected Return % (profit margin) */}
        <td className="px-3 py-2.5">
          <span className={clsx(
            'text-sm font-bold font-mono',
            sig.expected_option_return_pct >= 50 ? 'text-green-300' :
            sig.expected_option_return_pct >= 20 ? 'text-yellow-400' : 'text-orange-400'
          )}>
            {sign(sig.expected_option_return_pct)}{sig.expected_option_return_pct.toFixed(1)}%
          </span>
        </td>

        {/* Confidence */}
        <td className="px-3 py-2.5"><ConfBar v={sig.confidence} /></td>

        {/* IV */}
        <td className="px-3 py-2.5 text-sm font-mono text-purple-300">{sig.iv}%</td>

        {/* Delta */}
        <td className="px-3 py-2.5 text-sm font-mono text-blue-300">
          {sign(sig.delta)}{sig.delta.toFixed(3)}
        </td>

        {/* Max loss */}
        <td className="px-3 py-2.5 text-xs font-mono text-red-400">
          ${sig.max_loss_per_contract.toFixed(0)}
        </td>

        {/* Action */}
        <td className="px-3 py-2.5">
          <button
            onClick={e => { e.stopPropagation(); onSimulate(sig) }}
            className={clsx(
              'text-xs px-2.5 py-1 rounded flex items-center gap-1 transition-colors whitespace-nowrap',
              isCall
                ? 'bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30'
                : 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30'
            )}
          >
            <Play size={9} />
            Simulate
          </button>
        </td>
      </tr>

      {/* Expanded row: Greeks + Mirror instruction */}
      {expanded && (
        <tr className="bg-[#0d1117]">
          <td colSpan={9} className="px-4 pb-3 pt-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1.5">Greeks at entry</div>
                <div className="flex flex-wrap gap-1.5">
                  <GreekBadge label="Δ" value={sig.delta} color="bg-blue-500/10 text-blue-300" />
                  <GreekBadge label="Γ" value={sig.gamma} color="bg-purple-500/10 text-purple-300" />
                  <GreekBadge label="Θ" value={sig.theta} color="bg-red-500/10 text-red-300" />
                  <GreekBadge label="V" value={sig.vega} color="bg-yellow-500/10 text-yellow-300" />
                </div>
                <div className="mt-1.5 text-xs text-gray-500">
                  <span className="text-gray-400">IV:</span> {sig.iv}% &nbsp;
                  <span className="text-gray-400">Stock target:</span> ${sig.underlying_target.toFixed(2)} &nbsp;
                  <span className="text-gray-400">Safety margin:</span> {sig.margin_of_safety_pct.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Mirror in your broker</div>
                <div className="bg-[#161b22] border border-[#21262d] rounded px-3 py-2 font-mono text-xs text-yellow-300 flex items-start gap-1">
                  <span className="flex-1">{sig.mirror_instruction}</span>
                  <CopyBtn text={sig.mirror_instruction} />
                </div>
                <div className="mt-1.5 text-xs text-gray-500 line-clamp-1">{sig.reasoning}</div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Auto Position Card ───────────────────────────────────────────────────────
function AutoPositionCard({ pos, onClose }: { pos: AutoPosition; onClose: (id: string) => void }) {
  const isCall = pos.option_type === 'CALL'
  const profitPct = ((pos.current_premium - pos.entry_premium) / pos.entry_premium * 100)

  return (
    <div className={clsx('rounded-lg border p-3 mb-2', pnlBg(pos.pnl))}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={clsx(
            'text-xs font-bold px-1.5 py-0.5 rounded',
            isCall ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          )}>
            {pos.option_type}
          </span>
          <span className="font-semibold text-white">{pos.symbol}</span>
          <span className="text-xs text-gray-500">
            ${pos.strike} strike · {pos.days_remaining}d left
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx('font-mono font-bold text-sm', pnlColor(pos.pnl))}>
            {sign(pos.pnl)}${pos.pnl.toFixed(2)}
          </span>
          <button
            onClick={() => onClose(pos.id)}
            className="text-gray-600 hover:text-red-400 transition-colors"
          ><X size={13} /></button>
        </div>
      </div>

      {/* P&L bar */}
      <div className="w-full h-1 rounded-full bg-gray-700 mb-2 overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all', profitPct >= 0 ? 'bg-green-400' : 'bg-red-400')}
          style={{ width: `${Math.min(100, Math.abs(profitPct))}%` }}
        />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-1 text-xs mb-1.5">
        <div>
          <div className="text-gray-500">Entry</div>
          <div className="font-mono text-white">${pos.entry_premium.toFixed(3)}</div>
        </div>
        <div>
          <div className="text-gray-500">Current</div>
          <div className={clsx('font-mono font-bold', pnlColor(profitPct))}>
            ${pos.current_premium.toFixed(3)}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Target</div>
          <div className="font-mono text-green-400">${pos.target_premium.toFixed(3)}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 text-xs mb-2">
        <div>
          <div className="text-gray-500">Contracts</div>
          <div className="font-mono text-white">{pos.contracts}</div>
        </div>
        <div>
          <div className="text-gray-500">Return %</div>
          <div className={clsx('font-mono font-bold', pnlColor(profitPct))}>
            {sign(profitPct)}{profitPct.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-gray-500">Conf</div>
          <div className="font-mono text-yellow-400">{Math.round(pos.confidence * 100)}%</div>
        </div>
      </div>

      {/* Mirror */}
      <div className="bg-black/20 rounded px-2 py-1.5 font-mono text-xs text-yellow-300 flex items-center gap-1">
        <span className="flex-1 truncate">{pos.mirror_instruction}</span>
        <CopyBtn text={pos.mirror_instruction} />
      </div>
    </div>
  )
}

// ─── Main Terminal ────────────────────────────────────────────────────────────
export default function OptionsTerminal() {
  const [signals, setSignals] = useState<OptionsSignal[]>([])
  const [positions, setPositions] = useState<AutoPosition[]>([])
  const [closedPositions, setClosedPositions] = useState<AutoPosition[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpd, setLastUpd] = useState<Date | null>(null)

  // Filters / sort
  const [sortBy, setSortBy] = useState<'profit' | 'confidence' | 'iv'>('profit')
  const [actionFilter, setActionFilter] = useState<'ALL' | 'CALL' | 'PUT'>('ALL')
  const [marketFilter, setMarketFilter] = useState<'ALL' | 'US' | 'INDIA' | 'CRYPTO'>('ALL')
  const [minConf, setMinConf] = useState(0.55)

  // Tab
  const [tab, setTab] = useState<'signals' | 'positions' | 'history'>('signals')

  // Sim msg
  const [simMsg, setSimMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Countdown
  const [countdown, setCountdown] = useState(30)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  // ─── Fetch ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [sigRes, posRes, closedRes, statsRes] = await Promise.all([
        optionsApi.signals(sortBy, actionFilter === 'ALL' ? undefined : actionFilter,
                           marketFilter === 'ALL' ? undefined : marketFilter, minConf, 80),
        optionsApi.positions(),
        optionsApi.closed(30),
        optionsApi.stats(),
      ])
      setSignals(sigRes.options || [])
      setPositions((posRes.positions || []).sort((a: AutoPosition, b: AutoPosition) => b.pnl - a.pnl))
      setClosedPositions(closedRes.positions || [])
      setStats(statsRes)
      setLastUpd(new Date())
      setCountdown(30)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [sortBy, actionFilter, marketFilter, minConf])

  useEffect(() => {
    fetchAll()
    const iv = setInterval(fetchAll, 30_000)
    return () => clearInterval(iv)
  }, [fetchAll])

  // Countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchAll(); return 30 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [fetchAll])

  // ─── Simulate ──────────────────────────────────────────────────────────
  const handleSimulate = useCallback(async (sig: OptionsSignal) => {
    try {
      await optionsApi.simulate({
        symbol: sig.symbol,
        market: sig.market,
        option_type: sig.option_type,
        stock_action: sig.underlying_action as 'BUY' | 'SELL',
        stock_price: sig.underlying_price,
        confidence: sig.confidence,
        expected_return_pct: sig.expected_option_return_pct,
        hold_days: sig.expiry_days,
        reasoning: sig.reasoning,
      })
      setSimMsg({ text: `Simulated ${sig.option_type} on ${sig.symbol}`, ok: true })
      setTimeout(() => { setSimMsg(null); fetchAll() }, 3000)
    } catch {
      setSimMsg({ text: 'Failed to simulate', ok: false })
      setTimeout(() => setSimMsg(null), 3000)
    }
  }, [fetchAll])

  const handleClosePosition = useCallback(async (id: string) => {
    try {
      await optionsApi.closePosition(id)
      fetchAll()
    } catch { /* silent */ }
  }, [fetchAll])

  // ─── Stats bar ─────────────────────────────────────────────────────────
  const totalOpenPnl = positions.reduce((a, p) => a + p.pnl, 0)

  return (
    <div className="min-h-0 flex flex-col bg-[#0d1117]">
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className="border-b border-[#21262d] px-6 py-3 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-yellow-400 animate-pulse" />
          <span className="font-bold text-white">Options Terminal</span>
          <span className="text-xs text-gray-500 ml-1">AI Auto-Managed</span>
        </div>

        {/* Stats */}
        {stats && (
          <>
            <div className="text-xs">
              <span className="text-gray-500">Open: </span>
              <span className="text-white font-mono font-bold">{stats.open_count}</span>
            </div>
            <div className="text-xs">
              <span className="text-gray-500">Unrealized: </span>
              <span className={clsx('font-mono font-bold', pnlColor(totalOpenPnl))}>
                {sign(totalOpenPnl)}${totalOpenPnl.toFixed(2)}
              </span>
            </div>
            <div className="text-xs">
              <span className="text-gray-500">Realized: </span>
              <span className={clsx('font-mono font-bold', pnlColor(stats.total_realized_pnl))}>
                {sign(stats.total_realized_pnl)}${stats.total_realized_pnl.toFixed(2)}
              </span>
            </div>
            <div className="text-xs">
              <span className="text-gray-500">Win Rate: </span>
              <span className={clsx('font-mono font-bold', stats.win_rate >= 50 ? 'text-green-400' : 'text-red-400')}>
                {stats.win_rate.toFixed(0)}%
              </span>
            </div>
            <div className="text-xs">
              <span className="text-gray-500">Best: </span>
              <span className="text-green-400 font-mono">${stats.best_trade.toFixed(2)}</span>
            </div>
          </>
        )}

        <div className="ml-auto text-xs text-gray-500 flex items-center gap-1">
          <RefreshCw size={10} className={countdown < 5 ? 'animate-spin text-brand-green' : ''} />
          {lastUpd ? lastUpd.toLocaleTimeString() : 'Loading…'} · {countdown}s
        </div>
      </div>

      {/* ── Sim notification ────────────────────────────────────────────── */}
      {simMsg && (
        <div className={clsx(
          'mx-6 mt-3 px-4 py-2 rounded border text-sm flex items-center gap-2',
          simMsg.ok ? 'bg-green-500/10 border-green-500/20 text-green-300'
                    : 'bg-red-500/10 border-red-500/20 text-red-300'
        )}>
          {simMsg.ok ? <CheckCircle size={14} /> : <X size={14} />}
          {simMsg.text}
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-4 flex items-center gap-4 border-b border-[#21262d]">
        {([
          ['signals',   `Options Signals (${signals.length})`],
          ['positions', `Live Positions (${positions.length})`],
          ['history',   `History (${closedPositions.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              'pb-2 text-sm font-medium border-b-2 transition-colors',
              tab === key
                ? 'border-brand-green text-brand-green'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            )}
          >{label}</button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">

        {/* ── SIGNALS TAB ──────────────────────────────────────────────── */}
        {tab === 'signals' && (
          <div className="flex flex-col h-full">
            {/* Filter bar */}
            <div className="px-6 py-3 flex flex-wrap items-center gap-3 border-b border-[#21262d] bg-[#0d1117]">
              <div className="flex items-center gap-1">
                <Filter size={11} className="text-gray-500" />
                <span className="text-xs text-gray-500">Sort by:</span>
              </div>
              {(['profit', 'confidence', 'iv'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={clsx(
                    'px-2.5 py-1 rounded text-xs transition-colors',
                    sortBy === s ? 'bg-brand-green/20 text-brand-green' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  {s === 'profit' ? 'Profit %' : s === 'confidence' ? 'Confidence' : 'IV'}
                </button>
              ))}
              <div className="h-4 w-px bg-[#30363d]" />
              {(['ALL', 'CALL', 'PUT'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setActionFilter(f)}
                  className={clsx(
                    'px-2.5 py-1 rounded text-xs transition-colors',
                    actionFilter === f
                      ? f === 'CALL' ? 'bg-green-500/20 text-green-400'
                        : f === 'PUT' ? 'bg-red-500/20 text-red-400'
                        : 'bg-gray-500/20 text-gray-300'
                      : 'text-gray-500 hover:text-gray-300'
                  )}
                >{f}</button>
              ))}
              <div className="h-4 w-px bg-[#30363d]" />
              {(['ALL', 'US', 'INDIA', 'CRYPTO'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMarketFilter(m)}
                  className={clsx(
                    'px-2 py-1 rounded text-xs transition-colors',
                    marketFilter === m ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'
                  )}
                >{m === 'ALL' ? '🌐' : m === 'US' ? '🇺🇸' : m === 'INDIA' ? '🇮🇳' : '₿'}</button>
              ))}
              <div className="h-4 w-px bg-[#30363d]" />
              <div className="flex items-center gap-2 text-xs text-gray-500">
                Min conf:
                <select
                  value={minConf}
                  onChange={e => setMinConf(parseFloat(e.target.value))}
                  className="bg-[#161b22] border border-[#30363d] rounded px-1.5 py-0.5 text-xs text-white"
                >
                  {[0.50, 0.55, 0.60, 0.65, 0.70, 0.75].map(v => (
                    <option key={v} value={v}>{Math.round(v * 100)}%</option>
                  ))}
                </select>
              </div>
              <div className="ml-auto text-xs text-gray-500">
                {signals.length} signals · {signals.filter(s => s.option_type === 'CALL').length} CALL · {signals.filter(s => s.option_type === 'PUT').length} PUT
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {loading && (
                <div className="flex items-center justify-center py-20 text-gray-500">
                  <RefreshCw size={16} className="animate-spin mr-2" />
                  Loading options signals…
                </div>
              )}
              {!loading && signals.length === 0 && (
                <div className="text-center py-20 text-gray-600">
                  <BarChart2 size={32} className="mx-auto mb-3 opacity-30" />
                  <p>No options signals match your filters.</p>
                  <p className="text-xs mt-1">Lower the confidence threshold or change market filter.</p>
                </div>
              )}
              {!loading && signals.length > 0 && (
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-[#0d1117] border-b border-[#21262d] z-10">
                    <tr className="text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2">Strike / Expiry</th>
                      <th className="px-3 py-2">Premium</th>
                      <th className="px-3 py-2">
                        <span className="flex items-center gap-1 text-yellow-400">
                          Profit % <ChevronDown size={10} />
                        </span>
                      </th>
                      <th className="px-3 py-2">Confidence</th>
                      <th className="px-3 py-2">IV</th>
                      <th className="px-3 py-2">Delta</th>
                      <th className="px-3 py-2">Max Loss</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map(sig => (
                      <SignalRow key={`${sig.symbol}-${sig.option_type}`} sig={sig} onSimulate={handleSimulate} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── POSITIONS TAB ──────────────────────────────────────────────── */}
        {tab === 'positions' && (
          <div className="flex flex-col h-full">
            {/* Info banner */}
            <div className="mx-6 mt-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 flex items-start gap-3">
              <Bot size={16} className="text-blue-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <span className="text-blue-300 font-medium">AI Auto-Managed</span>
                <span className="text-gray-400 ml-2">
                  The agent scans signals every 30 seconds and automatically opens/closes
                  options positions. Mirror these exact trades in your real broker using
                  the instructions below each position.
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-6 py-4">
              {positions.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <Activity size={32} className="mx-auto mb-3 opacity-30" />
                  <p>No open positions yet</p>
                  <p className="text-xs mt-1">The AI agent will auto-open positions within 30–60 seconds of finding high-confidence signals.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {positions.map(pos => (
                    <AutoPositionCard key={pos.id} pos={pos} onClose={handleClosePosition} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ────────────────────────────────────────────────── */}
        {tab === 'history' && (
          <div className="flex flex-col h-full">
            {/* Summary stats */}
            {stats && (
              <div className="px-6 pt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Closed Trades', value: stats.closed_count, color: 'text-white' },
                  { label: 'Win Rate',       value: `${stats.win_rate.toFixed(0)}%`, color: stats.win_rate >= 50 ? 'text-green-400' : 'text-red-400' },
                  { label: 'Total P&L',      value: `${sign(stats.total_realized_pnl)}$${stats.total_realized_pnl.toFixed(2)}`, color: pnlColor(stats.total_realized_pnl) },
                  { label: 'Best Trade',     value: `+$${stats.best_trade.toFixed(2)}`,  color: 'text-green-400' },
                  { label: 'Worst Trade',    value: `$${stats.worst_trade.toFixed(2)}`,  color: 'text-red-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#161b22] border border-[#21262d] rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">{label}</div>
                    <div className={clsx('text-lg font-bold font-mono', color)}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-auto px-6 py-4">
              {closedPositions.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <p>No closed trades yet</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-[#0d1117] border-b border-[#21262d]">
                    <tr className="text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-3 py-2 text-left">Symbol</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-right">Entry</th>
                      <th className="px-3 py-2 text-right">Exit</th>
                      <th className="px-3 py-2 text-right">P&L</th>
                      <th className="px-3 py-2 text-right">Return %</th>
                      <th className="px-3 py-2 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedPositions.map(pos => (
                      <tr key={pos.id} className="border-b border-[#21262d] hover:bg-[#161b22] text-sm">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-white">{pos.symbol}</div>
                          <div className="text-xs text-gray-500">${pos.strike} {pos.expiry_date}</div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={clsx(
                            'text-xs font-bold px-1.5 py-0.5 rounded',
                            pos.option_type === 'CALL' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          )}>{pos.option_type}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-300">
                          ${pos.entry_premium.toFixed(3)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-300">
                          ${(pos.exit_premium ?? pos.current_premium)?.toFixed(3)}
                        </td>
                        <td className={clsx('px-3 py-2 text-right font-mono font-bold', pnlColor(pos.pnl))}>
                          {sign(pos.pnl)}${pos.pnl.toFixed(2)}
                        </td>
                        <td className={clsx('px-3 py-2 text-right font-mono', pnlColor(pos.pnl_pct))}>
                          {sign(pos.pnl_pct)}{pos.pnl_pct.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs text-gray-400 capitalize">
                            {pos.exit_reason?.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
