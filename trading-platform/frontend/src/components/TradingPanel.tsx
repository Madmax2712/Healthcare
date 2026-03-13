import { useState } from 'react'
import { clsx } from 'clsx'
import { Zap, DollarSign, Hash, AlertCircle, CheckCircle } from 'lucide-react'
import { tradingApi } from '../services/api'
import { useAuthStore } from '../store'
import { useNavigate } from 'react-router-dom'
import type { Quote } from '../types'

interface Props {
  symbol: string
  market: string
  quote?: Quote
  onSuccess?: () => void
}

type TabType = 'BUY' | 'SELL'

export default function TradingPanel({ symbol, market, quote, onSuccess }: Props) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabType>('BUY')
  const [quantityType, setQuantityType] = useState<'shares' | 'dollars'>('dollars')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const price = quote?.price || 0

  const shares = quantityType === 'dollars'
    ? price > 0 ? (parseFloat(amount) / price) : 0
    : parseFloat(amount) || 0

  const totalCost = shares * price

  const handleTrade = async () => {
    if (!user) { navigate('/login'); return }
    if (!amount || parseFloat(amount) <= 0) return

    setLoading(true)
    setResult(null)
    try {
      await tradingApi.executeTrade({
        symbol,
        market,
        action: tab,
        quantity: shares,
        price,
      })
      setResult({ success: true, message: `${tab} order executed: ${shares.toFixed(4)} ${symbol} @ $${price.toFixed(2)}` })
      setAmount('')
      onSuccess?.()
    } catch (err: any) {
      setResult({ success: false, message: err.response?.data?.detail || 'Trade failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleAITrade = async () => {
    if (!user) { navigate('/login'); return }

    setAiLoading(true)
    setResult(null)
    try {
      const res = await tradingApi.aiTrade(symbol, market)
      if (res.success) {
        setResult({
          success: true,
          message: `AI ${res.action || 'trade'} executed with ${Math.round((res.ai_decision?.confidence || 0) * 100)}% confidence`,
        })
        onSuccess?.()
      } else {
        setResult({ success: false, message: res.message || 'AI recommends HOLD' })
      }
    } catch (err: any) {
      setResult({ success: false, message: err.response?.data?.detail || 'AI trade failed' })
    } finally {
      setAiLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="card text-center space-y-3">
        <p className="text-gray-400">Sign in to start trading</p>
        <button onClick={() => navigate('/login')} className="btn-primary w-full">
          Sign In
        </button>
      </div>
    )
  }

  return (
    <div className="card space-y-4">
      <h3 className="font-semibold text-base">{symbol} — Paper Trade</h3>

      {/* AI Trade button */}
      <button
        onClick={handleAITrade}
        disabled={aiLoading}
        className="w-full bg-brand-green/15 border border-brand-green/30 text-brand-green font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-brand-green/25 transition-all disabled:opacity-50"
      >
        <Zap size={16} />
        {aiLoading ? 'Analyzing...' : 'Let AI Trade for Me'}
      </button>

      <div className="flex items-center gap-2 text-gray-600 text-xs">
        <div className="flex-1 h-px bg-dark-border" />
        <span>or trade manually</span>
        <div className="flex-1 h-px bg-dark-border" />
      </div>

      {/* Buy/Sell tabs */}
      <div className="flex rounded-xl overflow-hidden border border-dark-border">
        {(['BUY', 'SELL'] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex-1 py-2.5 text-sm font-semibold transition-all',
              tab === t
                ? t === 'BUY' ? 'bg-brand-green text-black' : 'bg-accent-red text-white'
                : 'text-gray-500 hover:text-white'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="space-y-3">
        <div className="flex rounded-xl overflow-hidden border border-dark-border text-xs">
          <button
            onClick={() => setQuantityType('dollars')}
            className={clsx('flex-1 py-2 flex items-center justify-center gap-1 transition-all',
              quantityType === 'dollars' ? 'bg-dark-surface text-white' : 'text-gray-500')}
          >
            <DollarSign size={12} />Dollars
          </button>
          <button
            onClick={() => setQuantityType('shares')}
            className={clsx('flex-1 py-2 flex items-center justify-center gap-1 transition-all',
              quantityType === 'shares' ? 'bg-dark-surface text-white' : 'text-gray-500')}
          >
            <Hash size={12} />Shares
          </button>
        </div>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            {quantityType === 'dollars' ? '$' : '#'}
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={quantityType === 'dollars' ? '0.00' : '0'}
            className="input-field pl-7"
            min="0"
            step={quantityType === 'dollars' ? '0.01' : '0.0001'}
          />
        </div>

        {/* Order summary */}
        {parseFloat(amount) > 0 && price > 0 && (
          <div className="bg-dark-surface rounded-xl p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Shares</span>
              <span className="font-mono">{shares.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Market Price</span>
              <span className="font-mono">${price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-dark-border pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-mono font-semibold">${totalCost.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Execute button */}
      <button
        onClick={handleTrade}
        disabled={loading || !amount || parseFloat(amount) <= 0}
        className={clsx(
          'w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50',
          tab === 'BUY' ? 'bg-brand-green text-black hover:bg-brand-green-dark' : 'bg-accent-red text-white hover:opacity-90'
        )}
      >
        {loading ? 'Executing...' : `${tab} ${symbol}`}
      </button>

      {/* Result feedback */}
      {result && (
        <div className={clsx(
          'flex items-start gap-2 p-3 rounded-xl text-sm',
          result.success ? 'bg-brand-green/10 text-brand-green' : 'bg-accent-red/10 text-accent-red'
        )}>
          {result.success ? <CheckCircle size={15} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />}
          <span>{result.message}</span>
        </div>
      )}

      <p className="text-xs text-gray-600 text-center">
        Paper trading only — no real money at risk
      </p>
    </div>
  )
}
