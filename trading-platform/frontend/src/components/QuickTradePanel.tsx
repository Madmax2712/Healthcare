import { useState } from 'react'
import { Zap, TrendingUp, TrendingDown, Shield, Target, AlertCircle, CheckCircle } from 'lucide-react'
import { useMarketStore } from '../store'
import { tradingApi, aiApi } from '../services/api'

type Side = 'BUY' | 'SELL'
type OrderType = 'MARKET' | 'LIMIT'

export default function QuickTradePanel() {
  const { selectedSymbol, liveQuotes } = useMarketStore()
  const quote = liveQuotes[selectedSymbol]
  const price = quote?.price ?? 0
  const market = quote?.market ?? 'US'

  const [side, setSide] = useState<Side>('BUY')
  const [orderType, setOrderType] = useState<OrderType>('MARKET')
  const [quantity, setQuantity] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null)
  const [aiSignal, setAiSignal] = useState<any>(null)
  const [loadingAi, setLoadingAi] = useState(false)

  const qty = parseFloat(quantity) || 0
  const execPrice = orderType === 'LIMIT' ? (parseFloat(limitPrice) || price) : price
  const total = qty * execPrice

  const handleTrade = async () => {
    if (!qty || qty <= 0) return
    setLoading(true)
    setResult(null)
    try {
      const res = await tradingApi.executeTrade({
        symbol: selectedSymbol,
        market,
        action: side,
        quantity: qty,
        price: orderType === 'LIMIT' ? parseFloat(limitPrice) || price : undefined,
      })
      setResult({ success: true, msg: `${side} ${qty} ${selectedSymbol} @ $${execPrice.toFixed(2)} executed` })
      setQuantity('')
    } catch (e: any) {
      setResult({ success: false, msg: e.response?.data?.detail || 'Trade failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleAiTrade = async () => {
    setLoadingAi(true)
    setResult(null)
    try {
      const res = await tradingApi.aiTrade(selectedSymbol, market)
      if (res.success) {
        setResult({ success: true, msg: `AI ${res.ai_decision?.action}: ${selectedSymbol} executed` })
      } else {
        setResult({ success: false, msg: res.message || 'AI recommends HOLD' })
      }
    } catch (e: any) {
      setResult({ success: false, msg: e.response?.data?.detail || 'AI trade failed' })
    } finally {
      setLoadingAi(false)
    }
  }

  const loadAiSignal = async () => {
    setLoadingAi(true)
    try {
      const res = await aiApi.signal(selectedSymbol, market)
      setAiSignal(res)
    } catch {
      setAiSignal(null)
    } finally {
      setLoadingAi(false)
    }
  }

  const QUICK_AMOUNTS = market === 'CRYPTO'
    ? [0.01, 0.05, 0.1, 0.5]
    : [1, 5, 10, 25]

  return (
    <div className="w-72 bg-[#0d1117] border-l border-[#21262d] flex flex-col overflow-y-auto flex-shrink-0">
      {/* Symbol info */}
      <div className="p-4 border-b border-[#21262d]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{quote?.name ?? selectedSymbol}</p>
            <p className="text-lg font-bold font-mono text-white">
              ${price >= 10000 ? price.toLocaleString('en', { maximumFractionDigits: 0 }) : price.toFixed(2)}
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded font-mono ${
            (quote?.change_pct ?? 0) >= 0 ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
          }`}>
            {(quote?.change_pct ?? 0) >= 0 ? '+' : ''}{(quote?.change_pct ?? 0).toFixed(2)}%
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-500">
          <span>H: ${(quote?.high ?? 0).toFixed(2)}</span>
          <span>L: ${(quote?.low ?? 0).toFixed(2)}</span>
        </div>
      </div>

      {/* AI Signal Banner */}
      <div className="p-3 border-b border-[#21262d]">
        {aiSignal ? (
          <div className={`rounded p-2 text-xs ${
            aiSignal.action === 'BUY' ? 'bg-green-500/10 border border-green-500/20' :
            aiSignal.action === 'SELL' ? 'bg-red-500/10 border border-red-500/20' :
            'bg-gray-500/10 border border-gray-500/20'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`font-bold ${
                aiSignal.action === 'BUY' ? 'text-green-400' :
                aiSignal.action === 'SELL' ? 'text-red-400' : 'text-gray-400'
              }`}>
                AI: {aiSignal.action}
              </span>
              <span className="text-gray-400">{(aiSignal.confidence * 100).toFixed(0)}% conf</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Target className="w-3 h-3" />
              <span>Target: ${aiSignal.target_price?.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Shield className="w-3 h-3" />
              <span>Stop: ${aiSignal.stop_loss?.toFixed(2)}</span>
            </div>
            <p className="text-gray-500 mt-1 line-clamp-2">{aiSignal.reasoning?.slice(0, 80)}...</p>
          </div>
        ) : (
          <button
            onClick={loadAiSignal}
            disabled={loadingAi}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/10 transition-colors disabled:opacity-50"
          >
            <Zap className="w-3 h-3" />
            {loadingAi ? 'Analyzing...' : 'Get AI Recommendation'}
          </button>
        )}
      </div>

      {/* Order form */}
      <div className="p-3 flex flex-col gap-3 flex-1">
        {/* BUY/SELL toggle */}
        <div className="flex rounded overflow-hidden border border-[#30363d]">
          {(['BUY', 'SELL'] as Side[]).map(s => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={`flex-1 py-1.5 text-xs font-bold transition-colors ${
                side === s
                  ? s === 'BUY' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {s === 'BUY' ? <TrendingUp className="w-3 h-3 inline mr-1" /> : <TrendingDown className="w-3 h-3 inline mr-1" />}
              {s}
            </button>
          ))}
        </div>

        {/* Order type */}
        <div className="flex gap-2">
          {(['MARKET', 'LIMIT'] as OrderType[]).map(ot => (
            <button
              key={ot}
              onClick={() => setOrderType(ot)}
              className={`flex-1 py-1 text-xs rounded transition-colors ${
                orderType === ot ? 'bg-[#21262d] text-white' : 'text-gray-500 hover:text-white'
              }`}
            >
              {ot}
            </button>
          ))}
        </div>

        {/* Quantity */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
          <input
            type="number"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="0.00"
            min="0"
            step={market === 'CRYPTO' ? '0.001' : '1'}
            className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
          />
          {/* Quick qty buttons */}
          <div className="flex gap-1 mt-1">
            {QUICK_AMOUNTS.map(amt => (
              <button
                key={amt}
                onClick={() => setQuantity(String(amt))}
                className="flex-1 py-0.5 text-xs text-gray-500 hover:text-white bg-[#161b22] rounded border border-[#30363d] hover:border-gray-500 transition-colors"
              >
                {amt}
              </button>
            ))}
          </div>
        </div>

        {/* Limit price */}
        {orderType === 'LIMIT' && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Limit Price</label>
            <input
              type="number"
              value={limitPrice}
              onChange={e => setLimitPrice(e.target.value)}
              placeholder={price.toFixed(2)}
              className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        {/* Order summary */}
        {qty > 0 && (
          <div className="bg-[#161b22] rounded p-2 text-xs">
            <div className="flex justify-between text-gray-400">
              <span>{qty} × ${execPrice.toFixed(2)}</span>
              <span className="text-white font-mono">${total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`flex items-center gap-2 text-xs p-2 rounded ${
            result.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {result.success ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            <span>{result.msg}</span>
          </div>
        )}

        {/* Execute button */}
        <button
          onClick={handleTrade}
          disabled={loading || !qty}
          className={`w-full py-2.5 text-sm font-bold rounded transition-all disabled:opacity-50 ${
            side === 'BUY'
              ? 'bg-green-500 hover:bg-green-400 text-white'
              : 'bg-red-500 hover:bg-red-400 text-white'
          }`}
        >
          {loading ? 'Executing...' : `${side} ${selectedSymbol}`}
        </button>

        {/* AI execute button */}
        <button
          onClick={handleAiTrade}
          disabled={loadingAi}
          className="w-full py-2 text-xs font-medium rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Zap className="w-3 h-3" />
          {loadingAi ? 'AI Analyzing...' : 'Let AI Trade'}
        </button>
      </div>
    </div>
  )
}
