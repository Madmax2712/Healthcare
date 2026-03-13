import { useQuery } from '@tanstack/react-query'
import { marketApi, aiApi, newsApi, tradingApi } from '../services/api'
import { clsx } from 'clsx'
import { TrendingUp, TrendingDown, Zap, Newspaper, Activity, Globe, Bitcoin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore, useMarketStore } from '../store'
import AISignalCard from '../components/AISignalCard'
import NewsCard from '../components/NewsCard'
import type { Quote, NewsArticle } from '../types'

function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="card">
      <p className="stat-label mb-1">{label}</p>
      <p className={clsx('text-2xl font-bold', positive === true ? 'positive' : positive === false ? 'negative' : '')}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function MarketCard({ quote, market }: { quote: Quote; market: string }) {
  const isPositive = quote.change_pct >= 0
  return (
    <Link
      to={`/markets?symbol=${quote.symbol}&market=${market}`}
      className="flex items-center justify-between p-3 rounded-xl bg-dark-surface hover:bg-dark-hover border border-transparent hover:border-brand-green/20 transition-all"
    >
      <div>
        <p className="text-sm font-semibold">{quote.symbol.replace('.NS', '').replace('-USD', '')}</p>
        <p className="text-xs text-gray-500">{quote.name}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm">${quote.price?.toFixed(2) ?? '—'}</p>
        <p className={clsx('text-xs flex items-center justify-end gap-0.5', isPositive ? 'positive' : 'negative')}>
          {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {isPositive ? '+' : ''}{quote.change_pct?.toFixed(2)}%
        </p>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const { liveQuotes } = useMarketStore()

  const { data: overview } = useQuery({
    queryKey: ['market-overview'],
    queryFn: marketApi.overview,
    refetchInterval: 60_000,
  })

  const { data: sentiment } = useQuery({
    queryKey: ['market-sentiment'],
    queryFn: aiApi.marketSentiment,
    refetchInterval: 300_000,
  })

  const { data: opportunities = [] } = useQuery({
    queryKey: ['top-opportunities'],
    queryFn: aiApi.topOpportunities,
    staleTime: 300_000,
  })

  const { data: news = [] } = useQuery({
    queryKey: ['news-global'],
    queryFn: () => newsApi.global(8),
    refetchInterval: 300_000,
  })

  const { data: portfolio } = useQuery({
    queryKey: ['portfolio'],
    queryFn: tradingApi.portfolio,
    enabled: !!user,
    refetchInterval: 60_000,
  })

  const sentimentColor = sentiment?.label === 'BULLISH' ? 'text-brand-green' :
    sentiment?.label === 'BEARISH' ? 'text-accent-red' : 'text-accent-yellow'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {user ? `Welcome back, ${user.username} 👋` : 'Global Markets Dashboard'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            AI-powered insights across US, India & Crypto markets
          </p>
        </div>
        {sentiment && (
          <div className="text-right">
            <p className="text-xs text-gray-500">Market Mood</p>
            <p className={clsx('font-bold text-lg', sentimentColor)}>{sentiment.label}</p>
            <p className="text-xs text-gray-600">{Math.round(sentiment.confidence * 100)}% confidence</p>
          </div>
        )}
      </div>

      {/* Portfolio stats (if logged in) */}
      {portfolio && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Portfolio Value"
            value={`$${portfolio.total_value?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />
          <StatCard
            label="Total P&L"
            value={`${portfolio.total_pnl >= 0 ? '+' : ''}$${portfolio.total_pnl?.toFixed(2)}`}
            sub={`${portfolio.total_pnl_pct >= 0 ? '+' : ''}${portfolio.total_pnl_pct?.toFixed(2)}%`}
            positive={portfolio.total_pnl >= 0}
          />
          <StatCard label="Cash" value={`$${portfolio.cash_balance?.toFixed(2)}`} />
          <StatCard label="Positions" value={String(portfolio.positions_count)} />
        </div>
      )}

      {/* Market overview + top opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Markets */}
        <div className="lg:col-span-2 space-y-4">
          {/* US Market */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={16} className="text-accent-blue" />
              <h2 className="font-semibold text-sm">US Market</h2>
            </div>
            <div className="space-y-1">
              {(overview?.US || []).map((q: Quote) => (
                <MarketCard key={q.symbol} quote={q} market="US" />
              ))}
              {(!overview?.US?.length) && (
                <p className="text-gray-600 text-sm text-center py-4">Loading market data...</p>
              )}
            </div>
          </div>

          {/* India + Crypto row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Globe size={16} className="text-accent-yellow" />
                <h2 className="font-semibold text-sm">India Market</h2>
              </div>
              <div className="space-y-1">
                {(overview?.INDIA || []).map((q: Quote) => (
                  <MarketCard key={q.symbol} quote={q} market="INDIA" />
                ))}
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Bitcoin size={16} className="text-accent-yellow" />
                <h2 className="font-semibold text-sm">Crypto</h2>
              </div>
              <div className="space-y-1">
                {(overview?.CRYPTO || []).map((q: Quote) => (
                  <MarketCard key={q.symbol} quote={q} market="CRYPTO" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Top AI opportunity */}
          {opportunities[0] && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap size={15} className="text-brand-green" />
                <h2 className="font-semibold text-sm">Top AI Opportunity</h2>
              </div>
              <div className="card border-brand-green/30">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-bold">{opportunities[0].symbol}</p>
                    <p className="text-xs text-gray-500">{opportunities[0].market}</p>
                  </div>
                  <span className={clsx(
                    'text-sm font-semibold px-3 py-1 rounded-full',
                    opportunities[0].action === 'BUY' ? 'badge-buy' : 'badge-sell'
                  )}>
                    {opportunities[0].action}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Confidence</span>
                    <p className="font-semibold">{Math.round(opportunities[0].confidence * 100)}%</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Expected Return</span>
                    <p className={clsx('font-semibold', opportunities[0].expected_return_pct >= 0 ? 'positive' : 'negative')}>
                      {opportunities[0].expected_return_pct >= 0 ? '+' : ''}{opportunities[0].expected_return_pct?.toFixed(2)}%
                    </p>
                  </div>
                </div>
                <Link to="/predictions" className="block mt-3 text-center text-xs text-brand-green hover:underline">
                  View all signals →
                </Link>
              </div>
            </div>
          )}

          {/* News */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Newspaper size={15} className="text-gray-400" />
                <h2 className="font-semibold text-sm">Latest News</h2>
              </div>
              <Link to="/news" className="text-xs text-gray-500 hover:text-brand-green transition-colors">
                View all →
              </Link>
            </div>
            <div className="card divide-y divide-dark-border p-0 overflow-hidden">
              {news.slice(0, 5).map((a: NewsArticle, i: number) => (
                <div key={i} className="px-4">
                  <NewsCard article={a} compact />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
