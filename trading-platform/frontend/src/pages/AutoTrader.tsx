import { useState, useEffect } from 'react'
import {
  Bot, Play, Square, TrendingUp, Shield, Target, Zap, Activity,
  BarChart2, ArrowUpRight, ArrowDownRight, Copy, DollarSign, Percent
} from 'lucide-react'
import { useAutoTraderStore } from '../store'
import { autoTraderApi, tradingApi } from '../services/api'
import AgentLogFeed from '../components/AgentLogFeed'
import GoalProgressCard from '../components/GoalProgressCard'
import { useMarketStore } from '../store'
import { clsx } from 'clsx'

type RiskTolerance = 'conservative' | 'moderate' | 'aggressive'

const AGENT_CARDS = [
  { name: 'market_scanner',  label: 'Market Scanner', icon: Activity,   color: 'purple' },
  { name: 'signal_agent',    label: 'Signal Agent',   icon: Zap,        color: 'blue'   },
  { name: 'risk_agent',      label: 'Risk Manager',   icon: Shield,     color: 'yellow' },
  { name: 'trade_executor',  label: 'Trade Executor', icon: TrendingUp, color: 'green'  },
  { name: 'position_monitor',label: 'Position Mon.',  icon: Target,     color: 'orange' },
  { name: 'goal_agent',      label: 'Goal Agent',     icon: BarChart2,  color: 'pink'   },
]

const COLOR_CLASSES: Record<string, string> = {
  purple: 'border-purple-500/30 bg-purple-500/5 text-purple-400',
  blue:   'border-blue-500/30 bg-blue-500/5 text-blue-400',
  yellow: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400',
  green:  'border-green-500/30 bg-green-500/5 text-green-400',
  orange: 'border-orange-500/30 bg-orange-500/5 text-orange-400',
  pink:   'border-pink-500/30 bg-pink-500/5 text-pink-400',
}

function PnLCell({ value }: { value: number }) {
  const pos = value >= 0
  return (
    <span className={clsx('font-mono text-xs font-bold flex items-center gap-0.5',
      pos ? 'text-green-400' : 'text-red-400'
    )}>
      {pos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {pos ? '+' : ''}{value >= 0 ? value.toFixed(2) : Math.abs(value).toFixed(2)}
    </span>
  )
}

export default function AutoTrader() {
  const { isActive, setActive, setConfig, agentTrades, addTrade } = useAutoTraderStore()
  const liveQuotes = useMarketStore((s) => s.liveQuotes)

  const [deposit,      setDeposit]     = useState('10000')
  const [targetReturn, setTargetReturn] = useState('15')
  const [daysToGoal,   setDaysToGoal]  = useState('30')
  const [riskTol,      setRiskTol]     = useState<RiskTolerance>('moderate')
  const [loading,      setLoading]     = useState(false)
  const [error,        setError]       = useState('')
  const [portfolio,    setPortfolio]   = useState<any>(null)
  const [agentStatus,  setAgentStatus] = useState<any>(null)

  const loadPortfolio = async () => {
    try { setPortfolio(await tradingApi.portfolio()) } catch { /* silent */ }
  }

  const loadAgentStatus = async () => {
    try {
      const s = await autoTraderApi.status()
      setAgentStatus(s)
      const executions: any[] = s?.user_agents?.trade_executor?.recent_executions ?? []
      const knownTs = new Set(agentTrades.map((t: any) => t.timestamp + t.symbol))
      for (const ex of executions) {
        const key = (ex.timestamp ?? '') + (ex.symbol ?? '')
        if (!knownTs.has(key)) {
          addTrade({ symbol: ex.symbol, market: ex.market ?? 'US', action: ex.action,
            quantity: ex.quantity, price: ex.price, total_value: ex.total_value,
            confidence: ex.confidence ?? 0, timestamp: ex.timestamp })
          knownTs.add(key)
        }
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    loadPortfolio(); loadAgentStatus()
    const id = setInterval(() => { loadPortfolio(); loadAgentStatus() }, 8_000)
    return () => clearInterval(id)
  }, [isActive])

  const handleStart = async () => {
    setLoading(true); setError('')
    try {
      const cfg = { deposit: parseFloat(deposit), target_return_pct: parseFloat(targetReturn),
        days_to_goal: parseInt(daysToGoal), risk_tolerance: riskTol }
      await autoTraderApi.start(cfg)
      setActive(true); setConfig(cfg)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to start auto-trading')
    } finally { setLoading(false) }
  }

  const handleStop = async () => {
    setLoading(true)
    try { await autoTraderApi.stop(); setActive(false); setConfig(null) }
    catch (e: any) { setError(e.response?.data?.detail || 'Failed to stop') }
    finally { setLoading(false) }
  }

  const positions: any[] = portfolio?.positions ?? []
  const totalPnl    = portfolio?.total_pnl ?? 0
  const totalPnlPct = portfolio?.total_pnl_pct ?? 0
  const totalValue  = portfolio?.total_value ?? 0
  const cash        = portfolio?.cash_balance ?? 0
  const targetValue = parseFloat(deposit) * (1 + parseFloat(targetReturn) / 100)
  const projectedDaily = parseFloat(targetReturn) / parseFloat(daysToGoal)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Bot className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">AI Auto Trader</h1>
            <p className="text-xs text-gray-500">6-agent system — mirror the AI's positions to replicate its trades</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
          isActive ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
          {isActive ? 'TRADING LIVE' : 'INACTIVE'}
        </div>
      </div>

      {/* AI Portfolio Snapshot — shown when active */}
      {portfolio && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'AI Portfolio Value', value: `$${totalValue.toLocaleString('en', { maximumFractionDigits: 0 })}`, color: 'text-white', icon: DollarSign },
            { label: 'Cash Available',     value: `$${cash.toLocaleString('en', { maximumFractionDigits: 0 })}`,       color: 'text-blue-400',  icon: DollarSign },
            { label: 'Total P&L',          value: `${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toFixed(2)}`,      color: totalPnl >= 0 ? 'text-green-400' : 'text-red-400', icon: TrendingUp },
            { label: 'Return',             value: `${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%`,           color: totalPnlPct >= 0 ? 'text-green-400' : 'text-red-400', icon: Percent },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-[#0d1117] border border-[#21262d] rounded-xl p-4 flex items-start justify-between">
              <div>
                <p className="text-gray-500 text-xs">{label}</p>
                <p className={`font-mono font-bold text-lg ${color}`}>{value}</p>
              </div>
              <Icon size={16} className="text-gray-600 mt-0.5" />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">

        {/* Left: config panel */}
        <div className="col-span-12 lg:col-span-3 bg-[#0d1117] border border-[#21262d] rounded-xl p-4 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" />Configure Goal
          </h2>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Capital to Deploy ($)</label>
            <input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} disabled={isActive}
              className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500 disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Target Return (%)</label>
            <input type="number" value={targetReturn} onChange={e => setTargetReturn(e.target.value)} disabled={isActive} min="0.5" max="200"
              className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500 disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Timeframe (days)</label>
            <input type="number" value={daysToGoal} onChange={e => setDaysToGoal(e.target.value)} disabled={isActive} min="1" max="365"
              className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500 disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Risk Tolerance</label>
            <div className="flex gap-1">
              {(['conservative', 'moderate', 'aggressive'] as RiskTolerance[]).map(r => (
                <button key={r} onClick={() => setRiskTol(r)} disabled={isActive}
                  className={`flex-1 py-1.5 text-xs rounded transition-colors disabled:opacity-50 capitalize ${
                    riskTol === r
                      ? r === 'conservative' ? 'bg-blue-600 text-white'
                        : r === 'moderate' ? 'bg-yellow-600 text-white'
                        : 'bg-red-600 text-white'
                      : 'bg-[#161b22] text-gray-400 hover:text-white border border-[#30363d]'
                  }`}>{r.slice(0, 4)}</button>
              ))}
            </div>
          </div>

          <div className="bg-[#161b22] rounded p-3 text-xs space-y-1">
            <div className="flex justify-between text-gray-500">
              <span>Target amount</span>
              <span className="text-green-400 font-mono">${targetValue.toLocaleString('en', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Required daily</span>
              <span className="text-yellow-400 font-mono">~{projectedDaily.toFixed(2)}%/day</span>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {isActive ? (
            <button onClick={handleStop} disabled={loading}
              className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              <Square className="w-4 h-4" />Stop Auto-Trading
            </button>
          ) : (
            <button onClick={handleStart} disabled={loading}
              className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              <Play className="w-4 h-4" />
              {loading ? 'Starting...' : 'Start Auto-Trading'}
            </button>
          )}

          {/* Agent status mini-cards */}
          <div className="space-y-1.5 pt-1">
            {AGENT_CARDS.map(({ name, label, icon: Icon, color }) => {
              const isShared = ['market_scanner', 'signal_agent'].includes(name)
              const agentData = isShared
                ? agentStatus?.shared_agents?.[name]
                : agentStatus?.user_agents?.[name]
              const running = agentData?.status === 'running'
              return (
                <div key={name} className={`border rounded-lg px-2.5 py-2 flex items-center gap-2 ${COLOR_CLASSES[color]}`}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs flex-1 text-white">{label}</span>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${(isShared || isActive) ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                  {agentData?.run_count != null && (
                    <span className="text-xs text-gray-500">×{agentData.run_count}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Center: Live AI Positions (mirror this to copy) */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <GoalProgressCard />

          {/* Live Positions */}
          <div className="bg-[#0d1117] border border-[#21262d] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#21262d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Copy size={14} className="text-yellow-400" />
                <span className="text-sm font-semibold text-white">AI's Open Positions</span>
                <span className="text-xs text-gray-500">— mirror these to copy the AI</span>
              </div>
              <span className="text-xs text-gray-500">{positions.length} open</span>
            </div>

            {positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-600 gap-2">
                <Bot size={28} className="text-gray-700" />
                <p className="text-sm text-gray-500">{isActive ? 'No open positions yet' : 'Start auto-trading to see AI positions'}</p>
                <p className="text-xs text-gray-600">AI will open positions when high-confidence signals fire</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-[#21262d]">
                      <th className="px-4 py-2 text-left">Symbol</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2 text-right">Entry</th>
                      <th className="px-4 py-2 text-right">Now</th>
                      <th className="px-4 py-2 text-right">Value</th>
                      <th className="px-4 py-2 text-right">P&amp;L</th>
                      <th className="px-4 py-2 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos: any) => {
                      const liveQ = liveQuotes[pos.symbol]
                      const currentPrice = liveQ?.price ?? pos.current_price ?? pos.avg_cost
                      const marketValue  = currentPrice * pos.quantity
                      const pnl          = marketValue - pos.avg_cost * pos.quantity
                      const pnlPct       = pos.avg_cost > 0 ? ((currentPrice - pos.avg_cost) / pos.avg_cost) * 100 : 0
                      return (
                        <tr key={pos.symbol} className="border-b border-[#21262d]/50 hover:bg-[#161b22] transition-colors">
                          <td className="px-4 py-2.5">
                            <span className="font-mono font-bold text-white">{pos.symbol}</span>
                            <span className="text-gray-600 ml-1">{pos.market}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-300">
                            {pos.quantity >= 1 ? pos.quantity.toFixed(2) : pos.quantity.toFixed(4)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-400">${pos.avg_cost?.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-white">${currentPrice.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-300">${marketValue.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right"><PnLCell value={pnl} /></td>
                          <td className={clsx('px-4 py-2.5 text-right font-mono font-bold',
                            pnlPct >= 0 ? 'text-green-400' : 'text-red-400'
                          )}>
                            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {positions.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-[#30363d] bg-[#161b22]">
                        <td colSpan={4} className="px-4 py-2 text-xs text-gray-500 font-semibold">Total</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-white font-bold">
                          ${positions.reduce((s: number, p: any) => {
                            const cp = liveQuotes[p.symbol]?.price ?? p.current_price ?? p.avg_cost
                            return s + cp * p.quantity
                          }, 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <PnLCell value={positions.reduce((s: number, p: any) => {
                            const cp = liveQuotes[p.symbol]?.price ?? p.current_price ?? p.avg_cost
                            return s + (cp - p.avg_cost) * p.quantity
                          }, 0)} />
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          {/* How to mirror box */}
          {isActive && positions.length > 0 && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-xs text-gray-400 space-y-1">
              <p className="text-yellow-400 font-semibold flex items-center gap-1.5">
                <Copy size={13} />How to mirror the AI
              </p>
              <p>1. The table above shows every position the AI holds right now.</p>
              <p>2. Go to <strong className="text-white">Markets</strong> → search the symbol → click <strong className="text-white">Buy / Sell</strong> to match.</p>
              <p>3. Use proportional sizing: if AI holds 5% of $10k in NVDA, put 5% of your capital into NVDA.</p>
            </div>
          )}
        </div>

        {/* Right: Recent AI trades + log */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* Recent AI Executions */}
          <div className="bg-[#0d1117] border border-[#21262d] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#21262d] flex items-center gap-2">
              <TrendingUp size={14} className="text-blue-400" />
              <span className="text-sm font-semibold text-white">Recent AI Trades</span>
              <span className="text-xs text-gray-500 ml-auto">{agentTrades.length} total</span>
            </div>
            <div className="divide-y divide-[#21262d]/50 max-h-72 overflow-y-auto">
              {agentTrades.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-8">No trades yet — AI will trade when confident signals fire</p>
              ) : agentTrades.slice(0, 30).map((trade, i) => {
                const liveQ = liveQuotes[trade.symbol]
                const pnlPct = liveQ?.price && trade.action === 'BUY'
                  ? ((liveQ.price - trade.price) / trade.price) * 100 : null
                return (
                  <div key={i} className="px-4 py-2.5 hover:bg-[#161b22] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                          trade.action === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        }`}>{trade.action}</span>
                        <span className="font-mono font-bold text-white text-xs">{trade.symbol}</span>
                        <span className="text-gray-600 text-xs">{trade.market}</span>
                      </div>
                      {pnlPct !== null && (
                        <span className={clsx('text-xs font-mono font-bold', pnlPct >= 0 ? 'text-green-400' : 'text-red-400')}>
                          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-gray-400 text-xs font-mono">
                        {trade.quantity.toFixed(trade.quantity < 1 ? 4 : 2)} @ ${trade.price.toFixed(2)}
                      </span>
                      <span className="text-gray-500 text-xs font-mono">${trade.total_value.toFixed(2)}</span>
                    </div>
                    <p className="text-gray-700 text-xs">{new Date(trade.timestamp).toLocaleTimeString()}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Live Agent Log */}
          <div className="bg-[#0d1117] border border-[#21262d] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#21262d] flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-green-400" />Live Agent Log
              </span>
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            </div>
            <div className="p-2">
              <AgentLogFeed maxHeight={240} />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
