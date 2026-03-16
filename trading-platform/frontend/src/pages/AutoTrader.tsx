import { useState, useEffect } from 'react'
import { Bot, Play, Square, TrendingUp, Shield, Target, Zap, Activity, RefreshCw, BarChart2 } from 'lucide-react'
import { useAutoTraderStore } from '../store'
import { autoTraderApi, tradingApi } from '../services/api'
import AgentLogFeed from '../components/AgentLogFeed'
import GoalProgressCard from '../components/GoalProgressCard'

type RiskTolerance = 'conservative' | 'moderate' | 'aggressive'

const AGENT_CARDS = [
  { name: 'market_scanner', label: 'Market Scanner', desc: 'Scans all symbols for breakout signals every 5s', icon: Activity, color: 'purple' },
  { name: 'signal_agent', label: 'Signal Agent', desc: '7-layer AI analysis: sentiment + technical + ML', icon: Zap, color: 'blue' },
  { name: 'risk_agent', label: 'Risk Manager', desc: 'Validates trades: daily limits, drawdown, concentration', icon: Shield, color: 'yellow' },
  { name: 'trade_executor', label: 'Trade Executor', desc: 'Executes approved trades with smart slippage modeling', icon: TrendingUp, color: 'green' },
  { name: 'position_monitor', label: 'Position Monitor', desc: 'Watches stop-loss, trailing stops & take-profit levels', icon: Target, color: 'orange' },
  { name: 'goal_agent', label: 'Goal Agent', desc: 'Adapts strategy dynamically based on return progress', icon: BarChart2, color: 'pink' },
]

const COLOR_CLASSES: Record<string, string> = {
  purple: 'border-purple-500/30 bg-purple-500/5 text-purple-400',
  blue: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
  yellow: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400',
  green: 'border-green-500/30 bg-green-500/5 text-green-400',
  orange: 'border-orange-500/30 bg-orange-500/5 text-orange-400',
  pink: 'border-pink-500/30 bg-pink-500/5 text-pink-400',
}

export default function AutoTrader() {
  const { isActive, setActive, setConfig, agentTrades, addTrade } = useAutoTraderStore()

  const [deposit, setDeposit] = useState('10000')
  const [targetReturn, setTargetReturn] = useState('15')
  const [daysToGoal, setDaysToGoal] = useState('30')
  const [riskTol, setRiskTol] = useState<RiskTolerance>('moderate')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [portfolio, setPortfolio] = useState<any>(null)
  const [agentStatus, setAgentStatus] = useState<any>(null)

  const loadPortfolio = async () => {
    try {
      const p = await tradingApi.portfolio()
      setPortfolio(p)
    } catch { /* silent */ }
  }

  const loadAgentStatus = async () => {
    try {
      const s = await autoTraderApi.status()
      setAgentStatus(s)
      // Seed store with execution history so trades show immediately (not only via WS)
      const executions: any[] = s?.user_agents?.trade_executor?.recent_executions ?? []
      const knownTs = new Set(agentTrades.map((t: any) => t.timestamp + t.symbol))
      for (const ex of executions) {
        const key = (ex.timestamp ?? '') + (ex.symbol ?? '')
        if (!knownTs.has(key)) {
          addTrade({
            symbol: ex.symbol,
            market: ex.market ?? 'US',
            action: ex.action,
            quantity: ex.quantity,
            price: ex.price,
            total_value: ex.total_value,
            confidence: ex.confidence ?? 0,
            timestamp: ex.timestamp,
          })
          knownTs.add(key)
        }
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    loadPortfolio()
    loadAgentStatus()
    const id = setInterval(() => { loadPortfolio(); loadAgentStatus() }, 10_000)
    return () => clearInterval(id)
  }, [isActive])

  const handleStart = async () => {
    setLoading(true)
    setError('')
    try {
      const cfg = {
        deposit: parseFloat(deposit),
        target_return_pct: parseFloat(targetReturn),
        days_to_goal: parseInt(daysToGoal),
        risk_tolerance: riskTol,
      }
      const res = await autoTraderApi.start(cfg)
      setActive(true)
      setConfig(cfg)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to start auto-trading')
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      await autoTraderApi.stop()
      setActive(false)
      setConfig(null)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to stop')
    } finally {
      setLoading(false)
    }
  }

  const targetValue = parseFloat(deposit) * (1 + parseFloat(targetReturn) / 100)
  const projectedDaily = parseFloat(targetReturn) / parseFloat(daysToGoal)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Bot className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Autonomous Trading</h1>
            <p className="text-xs text-gray-500">6-agent AI system — set a goal, let it trade</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
          isActive ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
          {isActive ? 'TRADING LIVE' : 'INACTIVE'}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Config Panel */}
        <div className="col-span-1 bg-[#0d1117] border border-[#21262d] rounded-xl p-4 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" />
            Configure Goal
          </h2>

          {/* Deposit */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Capital to Deploy ($)</label>
            <input
              type="number"
              value={deposit}
              onChange={e => setDeposit(e.target.value)}
              disabled={isActive}
              className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>

          {/* Target Return */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Target Return (%)</label>
            <input
              type="number"
              value={targetReturn}
              onChange={e => setTargetReturn(e.target.value)}
              disabled={isActive}
              min="0.5" max="200"
              className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>

          {/* Days */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Timeframe (days)</label>
            <input
              type="number"
              value={daysToGoal}
              onChange={e => setDaysToGoal(e.target.value)}
              disabled={isActive}
              min="1" max="365"
              className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>

          {/* Risk tolerance */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Risk Tolerance</label>
            <div className="flex gap-1">
              {(['conservative', 'moderate', 'aggressive'] as RiskTolerance[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRiskTol(r)}
                  disabled={isActive}
                  className={`flex-1 py-1.5 text-xs rounded transition-colors disabled:opacity-50 capitalize ${
                    riskTol === r
                      ? r === 'conservative' ? 'bg-blue-600 text-white'
                        : r === 'moderate' ? 'bg-yellow-600 text-white'
                        : 'bg-red-600 text-white'
                      : 'bg-[#161b22] text-gray-400 hover:text-white border border-[#30363d]'
                  }`}
                >
                  {r.slice(0, 4)}
                </button>
              ))}
            </div>
          </div>

          {/* Projection */}
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

          {/* CTA */}
          {isActive ? (
            <button
              onClick={handleStop}
              disabled={loading}
              className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop Auto-Trading
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {loading ? 'Starting...' : 'Start Auto-Trading'}
            </button>
          )}
        </div>

        {/* Middle: Goal + Agents */}
        <div className="col-span-1 space-y-4">
          <GoalProgressCard />

          {/* Portfolio */}
          {portfolio && (
            <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-3">Live Portfolio</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'Total Value', value: `$${(portfolio.total_value || 0).toLocaleString('en', { maximumFractionDigits: 0 })}`, color: 'text-white' },
                  { label: 'Cash', value: `$${(portfolio.cash_balance || 0).toLocaleString('en', { maximumFractionDigits: 0 })}`, color: 'text-green-400' },
                  { label: 'Total P&L', value: `${portfolio.total_pnl >= 0 ? '+' : ''}$${(portfolio.total_pnl || 0).toFixed(0)}`, color: portfolio.total_pnl >= 0 ? 'text-green-400' : 'text-red-400' },
                  { label: 'Positions', value: portfolio.positions?.length ?? 0, color: 'text-blue-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#161b22] rounded p-2">
                    <p className="text-gray-500">{label}</p>
                    <p className={`font-mono font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent status cards */}
          <div className="space-y-2">
            {AGENT_CARDS.map(({ name, label, desc, icon: Icon, color }) => {
              const isShared = ['market_scanner', 'signal_agent'].includes(name)
              const agentData = isShared
                ? agentStatus?.shared_agents?.[name]
                : agentStatus?.user_agents?.[name.replace('position_monitor', 'position_monitor').replace('trade_executor', 'trade_executor').replace('signal_agent', 'signal_agent').replace('market_scanner', 'market_scanner')]
              const running = agentData?.status === 'running'

              return (
                <div key={name} className={`border rounded-lg p-3 flex items-center gap-3 ${COLOR_CLASSES[color]}`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{label}</span>
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        (isShared || isActive) ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
                      }`} />
                    </div>
                    <p className="text-xs text-gray-500 truncate">{desc}</p>
                  </div>
                  {agentData?.run_count != null && (
                    <span className="text-xs text-gray-500 flex-shrink-0">×{agentData.run_count}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Log feed + Trades */}
        <div className="col-span-1 space-y-4">
          {/* Agent Log */}
          <div className="bg-[#0d1117] border border-[#21262d] rounded-xl">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#21262d]">
              <span className="text-xs font-semibold text-gray-400 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-green-400" /> Live Agent Log
              </span>
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            </div>
            <div className="p-2">
              <AgentLogFeed maxHeight={280} />
            </div>
          </div>

          {/* Recent Agent Trades */}
          <div className="bg-[#0d1117] border border-[#21262d] rounded-xl">
            <div className="px-4 py-2.5 border-b border-[#21262d]">
              <span className="text-xs font-semibold text-gray-400 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" /> Agent Trades
              </span>
            </div>
            <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
              {agentTrades.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-4">No agent trades yet</p>
              ) : agentTrades.map((trade, i) => (
                <div key={i} className="flex items-center justify-between px-2 py-1.5 bg-[#161b22] rounded text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold px-1.5 py-0.5 rounded text-xs ${
                      trade.action === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>{trade.action}</span>
                    <span className="text-white font-mono">{trade.symbol}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-300 font-mono">{trade.quantity.toFixed(3)} @ ${trade.price.toFixed(2)}</p>
                    <p className="text-gray-500">${trade.total_value.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
