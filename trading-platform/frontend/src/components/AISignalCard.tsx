import { clsx } from 'clsx'
import { TrendingUp, TrendingDown, Minus, Target, Shield, Zap, BarChart2, MessageSquare } from 'lucide-react'
import type { AISignal } from '../types'

interface Props {
  signal: AISignal
  compact?: boolean
  onTrade?: (action: 'BUY' | 'SELL') => void
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { cls: string; Icon: typeof TrendingUp }> = {
    BUY: { cls: 'badge-buy', Icon: TrendingUp },
    SELL: { cls: 'badge-sell', Icon: TrendingDown },
    HOLD: { cls: 'badge-hold', Icon: Minus },
  }
  const { cls, Icon } = map[action] || map['HOLD']
  return (
    <span className={clsx(cls, 'inline-flex items-center gap-1 text-sm px-3 py-1')}>
      <Icon size={13} />
      {action}
    </span>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 75 ? 'bg-brand-green' : pct >= 55 ? 'bg-accent-yellow' : 'bg-accent-red'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">AI Confidence</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="h-1.5 bg-dark-surface rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SignalMeter({ label, score, icon: Icon }: { label: string; score: number; icon: typeof BarChart2 }) {
  const pct = Math.round(((score + 1) / 2) * 100)
  const isPositive = score >= 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-gray-500"><Icon size={11} />{label}</span>
        <span className={clsx('font-mono', isPositive ? 'text-brand-green' : 'text-accent-red')}>
          {score >= 0 ? '+' : ''}{score.toFixed(2)}
        </span>
      </div>
      <div className="h-1 bg-dark-surface rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full', isPositive ? 'bg-brand-green' : 'bg-accent-red')}
          style={{ width: `${Math.abs(score) * 100}%`, marginLeft: isPositive ? '50%' : `${50 - Math.abs(score) * 50}%` }}
        />
      </div>
    </div>
  )
}

export default function AISignalCard({ signal, compact, onTrade }: Props) {
  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-dark-surface rounded-xl border border-dark-border hover:border-brand-green/30 transition-all group cursor-pointer">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold',
            signal.action === 'BUY' ? 'bg-brand-green/15 text-brand-green' :
            signal.action === 'SELL' ? 'bg-accent-red/15 text-accent-red' :
            'bg-accent-yellow/15 text-accent-yellow'
          )}>
            {signal.action === 'BUY' ? '↑' : signal.action === 'SELL' ? '↓' : '–'}
          </div>
          <div>
            <p className="text-sm font-semibold">{signal.symbol}</p>
            <p className="text-xs text-gray-500">{signal.market}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono">${signal.current_price?.toFixed(2)}</p>
          <p className={clsx('text-xs', signal.expected_return_pct >= 0 ? 'text-brand-green' : 'text-accent-red')}>
            {signal.expected_return_pct >= 0 ? '+' : ''}{signal.expected_return_pct?.toFixed(2)}%
          </p>
        </div>
        <div className="text-right ml-4">
          <ActionBadge action={signal.action} />
          <p className="text-xs text-gray-500 mt-1">{Math.round(signal.confidence * 100)}% conf.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-brand-green" />
            <span className="text-sm font-semibold text-brand-green">AI Trading Signal</span>
          </div>
          <h3 className="text-xl font-bold">{signal.symbol}</h3>
          <p className="text-sm text-gray-500">{signal.market} Market</p>
        </div>
        <ActionBadge action={signal.action} />
      </div>

      {/* Confidence */}
      <ConfidenceBar value={signal.confidence} />

      {/* Price targets */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dark-surface rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Current</p>
          <p className="font-mono font-semibold">${signal.current_price?.toFixed(2)}</p>
        </div>
        <div className="bg-brand-green/10 rounded-xl p-3 text-center border border-brand-green/20">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Target size={10} className="text-brand-green" />
            <p className="text-xs text-brand-green">Target</p>
          </div>
          <p className="font-mono font-semibold text-brand-green">${signal.target_price?.toFixed(2)}</p>
        </div>
        <div className="bg-accent-red/10 rounded-xl p-3 text-center border border-accent-red/20">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Shield size={10} className="text-accent-red" />
            <p className="text-xs text-accent-red">Stop Loss</p>
          </div>
          <p className="font-mono font-semibold text-accent-red">${signal.stop_loss?.toFixed(2)}</p>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-dark-surface rounded-xl p-3">
          <p className="text-gray-500 text-xs mb-1">Expected Return</p>
          <p className={clsx('font-semibold', signal.expected_return_pct >= 0 ? 'text-brand-green' : 'text-accent-red')}>
            {signal.expected_return_pct >= 0 ? '+' : ''}{signal.expected_return_pct?.toFixed(2)}%
          </p>
        </div>
        <div className="bg-dark-surface rounded-xl p-3">
          <p className="text-gray-500 text-xs mb-1">Risk/Reward</p>
          <p className="font-semibold">{signal.risk_reward_ratio?.toFixed(2)}x</p>
        </div>
      </div>

      {/* Signal breakdown */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Signal Breakdown</p>
        <SignalMeter label="Sentiment" score={signal.sentiment_score} icon={MessageSquare} />
        <SignalMeter label="Technical" score={signal.technical_score} icon={BarChart2} />
        <SignalMeter label="AI Prediction" score={signal.prediction_score || 0} icon={Zap} />
      </div>

      {/* Technical indicators */}
      {signal.signals?.technical && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            { label: 'RSI', value: signal.signals.technical.rsi?.toFixed(1) },
            { label: 'MACD', value: signal.signals.technical.macd },
            { label: 'BB', value: signal.signals.technical.bb },
            { label: 'EMA', value: signal.signals.technical.ema },
            { label: 'Volume', value: signal.signals.technical.volume },
            { label: 'Sentiment', value: signal.signals.sentiment?.label },
          ].map(({ label, value }) => (
            <div key={label} className="bg-dark-surface rounded-lg p-2 text-center">
              <p className="text-gray-600">{label}</p>
              <p className={clsx('font-semibold mt-0.5',
                value === 'BULLISH' || value === 'OVERSOLD' || value === 'HIGH' ? 'text-brand-green' :
                value === 'BEARISH' || value === 'OVERBOUGHT' ? 'text-accent-red' : ''
              )}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reasoning */}
      {signal.reasoning && (
        <div className="bg-dark-surface rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1 font-semibold">AI Reasoning</p>
          <p className="text-xs text-gray-300 leading-relaxed">{signal.reasoning}</p>
        </div>
      )}

      {/* Trade buttons */}
      {onTrade && signal.action !== 'HOLD' && (
        <div className="flex gap-2">
          {signal.action === 'BUY' ? (
            <button onClick={() => onTrade('BUY')} className="btn-primary flex-1 text-sm py-2.5">
              Execute Buy
            </button>
          ) : (
            <button onClick={() => onTrade('SELL')} className="btn-danger flex-1 text-sm py-2.5">
              Execute Sell
            </button>
          )}
        </div>
      )}
    </div>
  )
}
