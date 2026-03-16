import { Target, TrendingUp, Clock, Zap, AlertCircle } from 'lucide-react'
import { useAutoTraderStore } from '../store'

const STRATEGY_LABELS: Record<string, { label: string; color: string }> = {
  conservative: { label: 'Conservative', color: 'text-blue-400' },
  balanced: { label: 'Balanced', color: 'text-green-400' },
  growth: { label: 'Growth Mode', color: 'text-yellow-400' },
  aggressive: { label: 'Aggressive', color: 'text-orange-400' },
  capital_preservation: { label: 'Capital Preservation', color: 'text-gray-400' },
}

export default function GoalProgressCard() {
  const { goalProgress, isActive, config } = useAutoTraderStore()

  if (!isActive || !config) {
    return (
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 flex items-center justify-center h-28">
        <p className="text-gray-500 text-xs text-center">
          Configure a goal and start auto-trading<br />to track your progress here
        </p>
      </div>
    )
  }

  const gp = goalProgress
  const deposit = gp?.deposit ?? config.deposit
  const current = gp?.current_value ?? deposit
  const target = gp?.target_value ?? (deposit * (1 + config.target_return_pct / 100))
  const pnl = gp?.pnl ?? (current - deposit)
  const pnlPct = gp?.pnl_pct ?? 0
  const returnProgress = gp?.return_progress_pct ?? 0
  const timeProgress = gp?.time_progress_pct ?? 0
  const onTrack = gp?.on_track ?? true
  const strategy = gp?.strategy ?? 'balanced'
  const stratInfo = STRATEGY_LABELS[strategy] ?? { label: strategy, color: 'text-gray-400' }
  const daysLeft = gp?.days_remaining ?? config.days_to_goal

  const progressBarWidth = Math.min(Math.max(returnProgress, 0), 100)
  const timeBarWidth = Math.min(Math.max(timeProgress, 0), 100)

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-white">Goal Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          {onTrack ? (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <TrendingUp className="w-3 h-3" /> On Track
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <AlertCircle className="w-3 h-3" /> Behind
            </span>
          )}
        </div>
      </div>

      {/* Numbers */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <p className="text-xs text-gray-500">Deposited</p>
          <p className="text-sm font-bold font-mono text-white">${deposit.toLocaleString()}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Current</p>
          <p className={`text-sm font-bold font-mono ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${current.toLocaleString('en', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Target</p>
          <p className="text-sm font-bold font-mono text-blue-400">${target.toLocaleString('en', { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Return progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Return Progress</span>
          <span className={pnlPct >= 0 ? 'text-green-400' : 'text-red-400'}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}% / {config.target_return_pct}%
          </span>
        </div>
        <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              pnl >= 0 ? 'bg-green-500' : 'bg-red-500'
            }`}
            style={{ width: `${progressBarWidth}%` }}
          />
        </div>
      </div>

      {/* Time progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Time Elapsed</span>
          <span className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {daysLeft}d left
          </span>
        </div>
        <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
          <div
            className="h-full bg-gray-600 rounded-full transition-all duration-1000"
            style={{ width: `${timeBarWidth}%` }}
          />
        </div>
      </div>

      {/* Strategy badge */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 flex items-center gap-1">
          <Zap className="w-3 h-3" /> Strategy:
          <span className={`ml-1 font-semibold ${stratInfo.color}`}>{stratInfo.label}</span>
        </span>
        <span className="text-gray-500">
          Risk×{gp?.risk_multiplier?.toFixed(1) ?? '1.0'}
        </span>
      </div>
    </div>
  )
}
