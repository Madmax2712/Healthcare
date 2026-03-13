import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Zap, Globe, TrendingUp, BarChart2, Target, RefreshCw } from 'lucide-react'
import { aiApi, marketApi } from '../services/api'
import AISignalCard from '../components/AISignalCard'
import type { MarketType } from '../types'

const MARKETS: { label: string; value: MarketType; flag: string }[] = [
  { label: 'US Stocks', value: 'US', flag: '🇺🇸' },
  { label: 'India', value: 'INDIA', flag: '🇮🇳' },
  { label: 'Crypto', value: 'CRYPTO', flag: '₿' },
]

function SentimentGauge({ score, label }: { score: number; label: string }) {
  const pct = ((score + 1) / 2) * 100
  const color = label === 'BULLISH' ? '#00C805' : label === 'BEARISH' ? '#FF5000' : '#F5A623'

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Bearish</span>
        <span className="font-semibold" style={{ color }}>{label}</span>
        <span className="text-gray-500">Bullish</span>
      </div>
      <div className="h-3 bg-dark-surface rounded-full overflow-hidden relative">
        <div className="absolute inset-y-0 w-0.5 bg-gray-600 left-1/2" />
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.abs(score) * 50}%`,
            marginLeft: score >= 0 ? '50%' : `${50 - Math.abs(score) * 50}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  )
}

export default function Predictions() {
  const [market, setMarket] = useState<MarketType>('US')
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [customSymbol, setCustomSymbol] = useState('')

  const { data: bulkSignals = [], isLoading: bulkLoading, refetch } = useQuery({
    queryKey: ['bulk-signals', market],
    queryFn: () => aiApi.bulkSignals(market, 12),
    staleTime: 300_000,
  })

  const { data: sentiment } = useQuery({
    queryKey: ['market-sentiment'],
    queryFn: aiApi.marketSentiment,
    refetchInterval: 300_000,
  })

  const { data: opportunities = [], isLoading: oppLoading } = useQuery({
    queryKey: ['top-opportunities'],
    queryFn: aiApi.topOpportunities,
    staleTime: 300_000,
  })

  const { data: selectedSignal, isLoading: signalLoading } = useQuery({
    queryKey: ['signal', selectedSymbol, market],
    queryFn: () => aiApi.signal(selectedSymbol!, market),
    enabled: !!selectedSymbol,
    staleTime: 120_000,
  })

  const handleCustomAnalyze = () => {
    if (customSymbol.trim()) {
      setSelectedSymbol(customSymbol.trim().toUpperCase())
    }
  }

  const buySignals = bulkSignals.filter((s: any) => s.action === 'BUY')
  const sellSignals = bulkSignals.filter((s: any) => s.action === 'SELL')
  const holdSignals = bulkSignals.filter((s: any) => s.action === 'HOLD')

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Zap className="text-brand-green" size={22} />
            AI Trading Signals
          </h1>
          <p className="text-gray-500 text-sm">Multi-signal analysis: sentiment + technical + prediction</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary text-sm py-2 flex items-center gap-2"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Market sentiment */}
      {sentiment && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-gray-400" />
            <h2 className="font-semibold">Global Market Sentiment</h2>
            <span className="text-xs text-gray-500">({sentiment.total_articles} articles analyzed)</span>
          </div>
          <SentimentGauge score={sentiment.score} label={sentiment.label} />
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="bg-brand-green/10 rounded-xl p-2">
              <p className="text-brand-green font-bold text-lg">{sentiment.bullish_count}</p>
              <p className="text-gray-500">Bullish</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-2">
              <p className="text-gray-300 font-bold text-lg">{sentiment.neutral_count}</p>
              <p className="text-gray-500">Neutral</p>
            </div>
            <div className="bg-accent-red/10 rounded-xl p-2">
              <p className="text-accent-red font-bold text-lg">{sentiment.bearish_count}</p>
              <p className="text-gray-500">Bearish</p>
            </div>
          </div>
        </div>
      )}

      {/* Custom symbol lookup */}
      <div className="card">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Target size={16} className="text-brand-green" />
          Analyze Any Symbol
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={customSymbol}
            onChange={(e) => setCustomSymbol(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomAnalyze()}
            placeholder="Enter symbol (e.g., AAPL, BTC-USD, RELIANCE.NS)"
            className="input-field flex-1"
          />
          <div className="flex gap-2">
            {MARKETS.map(m => (
              <button
                key={m.value}
                onClick={() => setMarket(m.value)}
                className={clsx(
                  'px-3 py-2 rounded-xl text-sm transition-all',
                  market === m.value ? 'bg-brand-green/20 text-brand-green' : 'bg-dark-surface text-gray-400'
                )}
              >
                {m.flag}
              </button>
            ))}
          </div>
          <button onClick={handleCustomAnalyze} className="btn-primary px-6">
            Analyze
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Bulk signals list */}
        <div className="xl:col-span-2 space-y-4">
          {/* Signal summary */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-brand-green/10 border border-brand-green/20 rounded-xl p-3">
              <p className="text-2xl font-bold text-brand-green">{buySignals.length}</p>
              <p className="text-xs text-gray-500">BUY Signals</p>
            </div>
            <div className="bg-accent-yellow/10 border border-accent-yellow/20 rounded-xl p-3">
              <p className="text-2xl font-bold text-accent-yellow">{holdSignals.length}</p>
              <p className="text-xs text-gray-500">HOLD Signals</p>
            </div>
            <div className="bg-accent-red/10 border border-accent-red/20 rounded-xl p-3">
              <p className="text-2xl font-bold text-accent-red">{sellSignals.length}</p>
              <p className="text-xs text-gray-500">SELL Signals</p>
            </div>
          </div>

          {/* Market tabs */}
          <div className="flex gap-2">
            {MARKETS.map(({ label, value, flag }) => (
              <button
                key={value}
                onClick={() => setMarket(value)}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  market === value
                    ? 'bg-brand-green/15 text-brand-green border border-brand-green/30'
                    : 'bg-dark-surface text-gray-400 hover:text-white border border-dark-border'
                )}
              >
                {flag} {label}
              </button>
            ))}
          </div>

          {/* Signal cards */}
          <div className="space-y-2">
            {bulkLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
              </div>
            ) : bulkSignals.map((s: any) => (
              <div
                key={s.symbol}
                onClick={() => setSelectedSymbol(s.symbol)}
                className="cursor-pointer"
              >
                <AISignalCard signal={s} compact />
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          {/* Top opportunities */}
          <div>
            <h2 className="font-semibold mb-2 flex items-center gap-2">
              <TrendingUp size={16} className="text-brand-green" />
              Top Opportunities
            </h2>
            <div className="space-y-2">
              {oppLoading ? (
                <div className="card flex items-center justify-center h-24">
                  <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                </div>
              ) : opportunities.slice(0, 5).map((opp: any) => (
                <div
                  key={opp.symbol}
                  onClick={() => { setSelectedSymbol(opp.symbol); setMarket(opp.market) }}
                  className="cursor-pointer p-3 bg-dark-surface rounded-xl border border-dark-border hover:border-brand-green/30 transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{opp.symbol.replace('.NS','').replace('-USD','')}</span>
                    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', opp.action === 'BUY' ? 'badge-buy' : 'badge-sell')}>
                      {opp.action}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{opp.market}</span>
                    <span className={clsx(opp.expected_return_pct >= 0 ? 'text-brand-green' : 'text-accent-red')}>
                      {opp.expected_return_pct >= 0 ? '+' : ''}{opp.expected_return_pct?.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected signal detail */}
          {selectedSymbol && (
            <div>
              <h2 className="font-semibold mb-2">Signal Detail: {selectedSymbol}</h2>
              {signalLoading ? (
                <div className="card flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                </div>
              ) : selectedSignal ? (
                <AISignalCard signal={selectedSignal} />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
