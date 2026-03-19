/**
 * Bloomberg-style Trading Terminal
 * Real-time signal feed | Live chart | AI positions | Simulate trades
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  TrendingUp, TrendingDown, Zap, Activity, DollarSign, RefreshCw,
  ChevronUp, ChevronDown, ArrowRight, BarChart2, Newspaper, Clock,
  CheckCircle, XCircle, Play, Target, ShieldAlert, Radio, Bot
} from 'lucide-react'
import { clsx } from 'clsx'
import { autoTraderApi, newsApi, tradingApi } from '../services/api'
import { useMarketStore } from '../store'
import LiveCandleChart from '../components/LiveCandleChart'
import AgentLogFeed from '../components/AgentLogFeed'

// ─── Types ────────────────────────────────────────────────────────────────────
interface LiveSignal {
  symbol: string
  market: string
  action: string
  confidence: number
  price: number
  change_pct: number
  target_price: number
  stop_loss: number
  expected_return_pct: number
  risk_reward: number
  reasoning: string
  source: string
  hold_days: number
  entry_date: string
  exit_date: string
  timestamp: string
}

interface SimPosition {
  symbol: string
  market: string
  action: string
  qty: number
  entry_price: number
  entry_time: string
  target_price: number
  stop_loss: number
  hold_days: number
  exit_date: string
  confidence: number
  source: string
}

// ─── Helper: P&L colour ──────────────────────────────────────────────────────
const pnlColor = (val: number) =>
  val > 0 ? 'text-green-400' : val < 0 ? 'text-red-400' : 'text-gray-400'

const pnlBg = (val: number) =>
  val > 0 ? 'bg-green-400/10 border-green-400/20' :
  val < 0 ? 'bg-red-400/10 border-red-400/20' :
  'bg-gray-400/10 border-gray-400/20'

// ─── Confidence bar ───────────────────────────────────────────────────────────
function ConfBar({ v }: { v: number }) {
  const pct = Math.round(v * 100)
  const color = pct >= 75 ? '#22c55e' : pct >= 55 ? '#eab308' : '#f97316'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-gray-700">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{pct}%</span>
    </div>
  )
}

// ─── Simulate position storage (session) ─────────────────────────────────────
const SIM_KEY = 'sim_positions'
function loadSim(): SimPosition[] {
  try { return JSON.parse(localStorage.getItem(SIM_KEY) || '[]') } catch { return [] }
}
function saveSim(p: SimPosition[]) {
  localStorage.setItem(SIM_KEY, JSON.stringify(p))
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TradingTerminal() {
  const { liveQuotes, setSelectedSymbol, selectedSymbol } = useMarketStore()

  // Signals
  const [signals, setSignals]   = useState<LiveSignal[]>([])
  const [loading, setLoading]   = useState(true)
  const [lastUpd, setLastUpd]   = useState<Date | null>(null)
  const [filter, setFilter]     = useState<'ALL' | 'BUY' | 'SELL'>('ALL')
  const [mktFilter, setMktFilter] = useState<'ALL' | 'US' | 'INDIA' | 'CRYPTO'>('ALL')
  const [selectedSig, setSelectedSig] = useState<LiveSignal | null>(null)
  const [expanded, setExpanded]  = useState<string | null>(null)

  // AI Trader
  const [portfolio, setPortfolio] = useState<any>(null)
  const [aiPositions, setAiPositions] = useState<any[]>([])

  // Simulate trades
  const [simPos, setSimPos] = useState<SimPosition[]>(loadSim)
  const [simMsg, setSimMsg]  = useState<string | null>(null)

  // News
  const [news, setNews] = useState<any[]>([])

  // Countdown
  const [countdown, setCountdown] = useState(30)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  // ─── Fetch signals ────────────────────────────────────────────────────────
  const fetchSignals = useCallback(async () => {
    try {
      const data = await autoTraderApi.liveSignals()
      const raw: LiveSignal[] = data.signals || []
      setSignals(raw)
      setLastUpd(new Date())
      setCountdown(30)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPortfolio = useCallback(async () => {
    try {
      const p = await tradingApi.portfolio()
      setPortfolio(p)
      setAiPositions(p.positions || [])
    } catch { /* silent */ }
  }, [])

  const fetchNews = useCallback(async () => {
    try {
      const sym = selectedSig?.symbol || selectedSymbol
      const n = await newsApi.symbol(sym, 6)
      setNews(n?.articles || n || [])
    } catch { /* silent */ }
  }, [selectedSig, selectedSymbol])

  useEffect(() => {
    fetchSignals()
    fetchPortfolio()
    fetchNews()
    const sig = setInterval(fetchSignals, 30_000)
    const pfl = setInterval(fetchPortfolio, 8_000)
    return () => { clearInterval(sig); clearInterval(pfl) }
  }, [])

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchSignals(); return 30 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [fetchSignals])

  // Re-fetch news when selected symbol changes
  useEffect(() => { fetchNews() }, [selectedSig, selectedSymbol])

  // ─── Simulate a trade ────────────────────────────────────────────────────
  const simulateTrade = useCallback((sig: LiveSignal) => {
    const liveQ = liveQuotes[sig.symbol]
    const price = liveQ?.price ?? sig.price
    if (!price) { setSimMsg('No live price available'); return }

    const existing = simPos.find(p => p.symbol === sig.symbol)
    if (existing) { setSimMsg(`Already simulating ${sig.symbol}`); return }

    // Size: simulate with $1000 notional
    const qty = parseFloat((1000 / price).toFixed(4))
    const newPos: SimPosition = {
      symbol: sig.symbol,
      market: sig.market,
      action: sig.action,
      qty,
      entry_price: price,
      entry_time: new Date().toISOString(),
      target_price: sig.target_price,
      stop_loss: sig.stop_loss,
      hold_days: sig.hold_days,
      exit_date: sig.exit_date,
      confidence: sig.confidence,
      source: sig.source,
    }
    const updated = [...simPos, newPos]
    setSimPos(updated)
    saveSim(updated)
    setSimMsg(`Simulating ${sig.action} ${sig.symbol} @ $${price.toFixed(2)}`)
    setTimeout(() => setSimMsg(null), 4000)
  }, [simPos, liveQuotes])

  const closeSim = useCallback((symbol: string) => {
    const updated = simPos.filter(p => p.symbol !== symbol)
    setSimPos(updated)
    saveSim(updated)
  }, [simPos])

  // ─── Filtered signals ────────────────────────────────────────────────────
  const displayed = signals.filter(s => {
    if (filter !== 'ALL' && s.action !== filter) return false
    if (mktFilter !== 'ALL' && s.market !== mktFilter) return false
    return true
  })

  // Stats
  const buyCount  = signals.filter(s => s.action === 'BUY').length
  const sellCount = signals.filter(s => s.action === 'SELL').length
  const holdCount = signals.filter(s => s.action === 'HOLD').length

  // ─── Live price for a symbol ─────────────────────────────────────────────
  const livePrice = (sym: string, fallback: number) =>
    liveQuotes[sym]?.price ?? fallback

  // ─── Sim P&L ─────────────────────────────────────────────────────────────
  const simPnl = (pos: SimPosition) => {
    const current = livePrice(pos.symbol, pos.entry_price)
    const diff = pos.action === 'BUY'
      ? (current - pos.entry_price) * pos.qty
      : (pos.entry_price - current) * pos.qty
    return diff
  }
  const simPnlPct = (pos: SimPosition) => {
    const current = livePrice(pos.symbol, pos.entry_price)
    return pos.action === 'BUY'
      ? ((current - pos.entry_price) / pos.entry_price) * 100
      : ((pos.entry_price - current) / pos.entry_price) * 100
  }

  // ─── AI position P&L (mark-to-market) ────────────────────────────────────
  const aiPnl = (pos: any) => {
    const current = livePrice(pos.symbol, pos.current_price ?? pos.avg_price)
    return pos.action === 'BUY'
      ? (current - pos.avg_price) * pos.quantity
      : (pos.avg_price - current) * pos.quantity
  }
  const aiPnlPct = (pos: any) => {
    const current = livePrice(pos.symbol, pos.current_price ?? pos.avg_price)
    return pos.action === 'BUY'
      ? ((current - pos.avg_price) / pos.avg_price) * 100
      : ((pos.avg_price - current) / pos.avg_price) * 100
  }

  // ─── Total simulated P&L ─────────────────────────────────────────────────
  const totalSimPnl = simPos.reduce((acc, p) => acc + simPnl(p), 0)

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col overflow-hidden bg-[#0d1117]" style={{ height: 'calc(100vh - 96px)' }}>

      {/* ── Top bar: stats ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-[#21262d] text-xs shrink-0">
        <span className="flex items-center gap-1.5 text-gray-400">
          <Radio size={11} className="text-yellow-400 animate-pulse" />
          LIVE SIGNALS
        </span>
        <span className="font-mono text-green-400">{buyCount} BUY</span>
        <span className="font-mono text-red-400">{sellCount} SELL</span>
        <span className="font-mono text-gray-500">{holdCount} HOLD</span>
        <div className="h-3 w-px bg-[#30363d]" />
        <span className="text-gray-500">
          {lastUpd ? `Updated ${lastUpd.toLocaleTimeString()}` : 'Loading...'}
        </span>
        <span className="text-gray-600 ml-auto flex items-center gap-1">
          <RefreshCw size={10} className={countdown < 5 ? 'animate-spin' : ''} />
          {countdown}s
        </span>
      </div>

      {/* ── Main 3-column layout ───────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Signal Feed ─────────────────────────────────────── */}
        <div className="w-80 shrink-0 flex flex-col border-r border-[#21262d] overflow-hidden">
          {/* Filters */}
          <div className="px-3 py-2 border-b border-[#21262d] shrink-0 space-y-1.5">
            <div className="flex gap-1">
              {(['ALL', 'BUY', 'SELL'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={clsx(
                    'px-2.5 py-0.5 rounded text-xs font-medium transition-colors',
                    filter === f
                      ? f === 'BUY' ? 'bg-green-500/20 text-green-400'
                        : f === 'SELL' ? 'bg-red-500/20 text-red-400'
                        : 'bg-brand-green/20 text-brand-green'
                      : 'text-gray-500 hover:text-gray-300'
                  )}
                >{f}</button>
              ))}
              <div className="flex-1" />
              {(['ALL', 'US', 'INDIA', 'CRYPTO'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMktFilter(m)}
                  className={clsx(
                    'px-2 py-0.5 rounded text-xs transition-colors',
                    mktFilter === m ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'
                  )}
                >{m === 'ALL' ? '🌐' : m === 'US' ? '🇺🇸' : m === 'INDIA' ? '🇮🇳' : '₿'}</button>
              ))}
            </div>
          </div>

          {/* Signal list */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
                <RefreshCw size={14} className="animate-spin mr-2" />
                Loading signals…
              </div>
            )}
            {!loading && displayed.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-600 text-sm">No signals match filter</div>
            )}
            {displayed.map(sig => {
              const live = livePrice(sig.symbol, sig.price)
              const chg  = sig.change_pct
              const isSelected = selectedSig?.symbol === sig.symbol
              const isExp = expanded === sig.symbol

              return (
                <div
                  key={sig.symbol}
                  className={clsx(
                    'border-b border-[#21262d] cursor-pointer transition-all',
                    isSelected ? 'bg-[#161b22]' : 'hover:bg-[#161b22]/60'
                  )}
                  onClick={() => {
                    setSelectedSig(sig)
                    setSelectedSymbol(sig.symbol)
                    setExpanded(isExp ? null : null)
                  }}
                >
                  <div className="px-3 py-2.5">
                    {/* Row 1: Symbol + Action + Price */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            'text-xs font-bold px-1.5 py-0.5 rounded',
                            sig.action === 'BUY' ? 'bg-green-500/20 text-green-400' :
                            sig.action === 'SELL' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          )}
                        >{sig.action}</span>
                        <span className="text-sm font-semibold text-white">{sig.symbol}</span>
                        <span className="text-xs text-gray-500">{sig.market}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono text-white">${live.toFixed(2)}</div>
                        <div className={clsx('text-xs font-mono', chg >= 0 ? 'text-green-400' : 'text-red-400')}>
                          {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Confidence + Hold */}
                    <div className="flex items-center justify-between">
                      <ConfBar v={sig.confidence} />
                      <span className="text-xs text-gray-500">{sig.hold_days}d hold</span>
                    </div>

                    {/* Row 3: Target / Stop */}
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <span className="text-gray-500">
                        Target: <span className="text-green-400 font-mono">${sig.target_price.toFixed(2)}</span>
                      </span>
                      <span className="text-gray-500">
                        Stop: <span className="text-red-400 font-mono">${sig.stop_loss.toFixed(2)}</span>
                      </span>
                      <span className="ml-auto text-gray-500">
                        <span className="text-yellow-400">{sig.expected_return_pct.toFixed(1)}%</span> exp
                      </span>
                    </div>

                    {/* Simulate button */}
                    <button
                      onClick={e => { e.stopPropagation(); simulateTrade(sig) }}
                      className={clsx(
                        'mt-2 w-full text-xs py-1 rounded flex items-center justify-center gap-1.5 transition-colors',
                        sig.action === 'BUY'
                          ? 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                      )}
                    >
                      <Play size={10} />
                      Simulate {sig.action}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── CENTER: Chart + News ───────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Selected signal header */}
          {selectedSig && (
            <div className="px-4 py-2 border-b border-[#21262d] flex items-center gap-4 shrink-0 bg-[#161b22]">
              <span className={clsx(
                'font-bold px-2 py-1 rounded text-sm',
                selectedSig.action === 'BUY' ? 'bg-green-500/20 text-green-400' :
                selectedSig.action === 'SELL' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              )}>{selectedSig.action}</span>
              <span className="font-bold text-white text-lg">{selectedSig.symbol}</span>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>Target <span className="text-green-400 font-mono">${selectedSig.target_price.toFixed(2)}</span></span>
                <span>Stop <span className="text-red-400 font-mono">${selectedSig.stop_loss.toFixed(2)}</span></span>
                <span>R:R <span className="text-yellow-400 font-mono">{selectedSig.risk_reward.toFixed(1)}x</span></span>
                <span>Hold <span className="text-blue-400 font-mono">{selectedSig.hold_days}d</span></span>
                <span className="text-gray-500">Exit: {selectedSig.exit_date}</span>
              </div>
              <div className="ml-auto text-xs text-gray-500 leading-tight max-w-xs truncate">
                {selectedSig.reasoning.split('|')[0]}
              </div>
            </div>
          )}

          {/* Chart — takes 60% height */}
          <div className="overflow-hidden" style={{ height: '55%' }}>
            <LiveCandleChart />
          </div>

          {/* Bottom split: News | Agent Log */}
          <div className="flex flex-1 border-t border-[#21262d] overflow-hidden">
            {/* News */}
            <div className="w-1/2 border-r border-[#21262d] flex flex-col overflow-hidden">
              <div className="px-3 py-1.5 border-b border-[#21262d] shrink-0 flex items-center gap-2">
                <Newspaper size={11} className="text-blue-400" />
                <span className="text-xs font-semibold text-gray-400">
                  News: {selectedSig?.symbol || selectedSymbol}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {news.length === 0 && (
                  <p className="text-xs text-gray-600 py-4 text-center">No recent news</p>
                )}
                {news.map((n, i) => (
                  <div key={i} className="border-b border-[#21262d] pb-2">
                    <a
                      href={n.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-300 hover:text-white leading-snug line-clamp-2"
                    >
                      {n.title || n.headline}
                    </a>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={clsx('text-xs px-1 rounded', {
                        'text-green-400 bg-green-400/10': (n.sentiment_score ?? n.score ?? 0) > 0.1,
                        'text-red-400 bg-red-400/10': (n.sentiment_score ?? n.score ?? 0) < -0.1,
                        'text-gray-500': Math.abs(n.sentiment_score ?? n.score ?? 0) <= 0.1,
                      })}>
                        {(n.sentiment_score ?? n.score ?? 0) > 0.1 ? '▲ Bullish' :
                         (n.sentiment_score ?? n.score ?? 0) < -0.1 ? '▼ Bearish' : '— Neutral'}
                      </span>
                      <span className="text-xs text-gray-600">{n.source || n.publisher}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Log */}
            <div className="w-1/2 overflow-hidden flex flex-col">
              <div className="px-3 py-1.5 border-b border-[#21262d] shrink-0 flex items-center gap-2">
                <Bot size={11} className="text-purple-400" />
                <span className="text-xs font-semibold text-gray-400">AI Agent Activity</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <AgentLogFeed maxHeight={999} />
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Positions ──────────────────────────────────────── */}
        <div className="w-72 shrink-0 flex flex-col border-l border-[#21262d] overflow-hidden">

          {/* Simulate notification */}
          {simMsg && (
            <div className="mx-2 mt-2 px-3 py-2 rounded bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 shrink-0">
              {simMsg}
            </div>
          )}

          {/* Portfolio summary */}
          {portfolio && (
            <div className="px-3 py-2 border-b border-[#21262d] shrink-0 grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500">Portfolio</div>
                <div className="text-sm font-mono font-bold text-white">
                  ${(portfolio.total_value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Cash</div>
                <div className="text-sm font-mono text-gray-300">
                  ${(portfolio.cash_balance ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Day P&L</div>
                <div className={clsx('text-sm font-mono font-bold', pnlColor(portfolio.daily_pnl ?? 0))}>
                  {(portfolio.daily_pnl ?? 0) >= 0 ? '+' : ''}${(portfolio.daily_pnl ?? 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total Return</div>
                <div className={clsx('text-sm font-mono', pnlColor(portfolio.total_return_pct ?? 0))}>
                  {(portfolio.total_return_pct ?? 0) >= 0 ? '+' : ''}{(portfolio.total_return_pct ?? 0).toFixed(2)}%
                </div>
              </div>
            </div>
          )}

          {/* Simulated Positions */}
          <div className="shrink-0 border-b border-[#21262d]">
            <div className="px-3 py-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                <Play size={10} /> Simulated ({simPos.length})
              </span>
              {simPos.length > 0 && (
                <span className={clsx('text-xs font-mono font-bold', pnlColor(totalSimPnl))}>
                  {totalSimPnl >= 0 ? '+' : ''}${totalSimPnl.toFixed(2)}
                </span>
              )}
            </div>
            <div className="max-h-40 overflow-y-auto">
              {simPos.length === 0 && (
                <p className="text-xs text-gray-600 px-3 pb-2">Click "Simulate" on any signal</p>
              )}
              {simPos.map(pos => {
                const pnl = simPnl(pos)
                const pnlp = simPnlPct(pos)
                const curr = livePrice(pos.symbol, pos.entry_price)
                return (
                  <div key={pos.symbol} className={clsx('mx-2 mb-1.5 rounded p-2 border text-xs', pnlBg(pnl))}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={clsx('font-bold', pos.action === 'BUY' ? 'text-green-400' : 'text-red-400')}>
                          {pos.action}
                        </span>
                        <span className="font-semibold text-white">{pos.symbol}</span>
                      </div>
                      <button
                        onClick={() => closeSim(pos.symbol)}
                        className="text-gray-600 hover:text-red-400 text-xs"
                      >✕</button>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Entry: <span className="font-mono text-white">${pos.entry_price.toFixed(2)}</span></span>
                      <span>Now: <span className="font-mono text-white">${curr.toFixed(2)}</span></span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className={clsx('font-mono font-bold', pnlColor(pnl))}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </span>
                      <span className={clsx('font-mono', pnlColor(pnlp))}>
                        {pnlp >= 0 ? '+' : ''}{pnlp.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-gray-600 mt-0.5">
                      {pos.qty.toFixed(4)} shares · Exit {pos.exit_date}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* AI Positions (live mark-to-market) */}
          <div className="flex flex-col overflow-hidden flex-1">
            <div className="px-3 py-1.5 border-b border-[#21262d] shrink-0">
              <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                <Bot size={10} /> AI Positions ({aiPositions.length})
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {aiPositions.length === 0 && (
                <p className="text-xs text-gray-600 px-3 py-3">
                  Start AI Trader to see auto positions
                </p>
              )}
              {aiPositions.map((pos: any) => {
                const pnl = aiPnl(pos)
                const pnlp = aiPnlPct(pos)
                const curr = livePrice(pos.symbol, pos.current_price ?? pos.avg_price)
                return (
                  <div key={pos.symbol} className={clsx('mx-2 my-1 rounded p-2 border text-xs', pnlBg(pnl))}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={clsx('font-bold', pos.action === 'BUY' ? 'text-green-400' : 'text-red-400')}>
                          {pos.action}
                        </span>
                        <span className="font-semibold text-white">{pos.symbol}</span>
                      </div>
                      <span className={clsx('font-mono font-bold text-xs', pnlColor(pnl))}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-400 mt-1">
                      <span>Avg: <span className="font-mono text-white">${(pos.avg_price ?? 0).toFixed(2)}</span></span>
                      <span>Now: <span className="font-mono text-white">${curr.toFixed(2)}</span></span>
                      <span className={clsx('font-mono', pnlColor(pnlp))}>
                        {pnlp >= 0 ? '+' : ''}{pnlp.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-gray-600">
                      {pos.quantity} shares · ${((pos.quantity ?? 0) * curr).toFixed(0)} value
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
