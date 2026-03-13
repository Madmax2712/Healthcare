import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import { newsApi } from '../services/api'
import NewsCard from '../components/NewsCard'
import type { NewsArticle } from '../types'

type Filter = 'ALL' | 'BULLISH' | 'BEARISH' | 'NEUTRAL'

const FILTERS: { label: string; value: Filter; Icon: typeof TrendingUp; cls: string }[] = [
  { label: 'All News', value: 'ALL', Icon: Newspaper, cls: '' },
  { label: 'Bullish', value: 'BULLISH', Icon: TrendingUp, cls: 'text-brand-green' },
  { label: 'Bearish', value: 'BEARISH', Icon: TrendingDown, cls: 'text-accent-red' },
  { label: 'Neutral', value: 'NEUTRAL', Icon: Minus, cls: 'text-gray-400' },
]

export default function News() {
  const [filter, setFilter] = useState<Filter>('ALL')

  const { data: articles = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['news-global-full'],
    queryFn: () => newsApi.global(50),
    refetchInterval: 300_000,
  })

  const { data: sentiment } = useQuery({
    queryKey: ['news-sentiment'],
    queryFn: newsApi.sentiment,
    refetchInterval: 300_000,
  })

  const filtered: NewsArticle[] = filter === 'ALL'
    ? articles
    : articles.filter((a: NewsArticle) => a.sentiment_label === filter)

  const bullishCount = articles.filter((a: NewsArticle) => a.sentiment_label === 'BULLISH').length
  const bearishCount = articles.filter((a: NewsArticle) => a.sentiment_label === 'BEARISH').length
  const neutralCount = articles.filter((a: NewsArticle) => a.sentiment_label === 'NEUTRAL').length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Newspaper size={20} className="text-gray-400" />
            Global Financial News
          </h1>
          <p className="text-gray-500 text-sm">AI-analyzed sentiment from global sources</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-secondary text-sm py-2 flex items-center gap-2"
        >
          <RefreshCw size={14} className={clsx(isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Sentiment summary */}
      {sentiment && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className={clsx(
            'card border',
            sentiment.label === 'BULLISH' ? 'border-brand-green/40 bg-brand-green/5' :
            sentiment.label === 'BEARISH' ? 'border-accent-red/40 bg-accent-red/5' :
            'border-dark-border'
          )}>
            <p className="stat-label">Market Mood</p>
            <p className={clsx(
              'text-xl font-bold',
              sentiment.label === 'BULLISH' ? 'positive' :
              sentiment.label === 'BEARISH' ? 'negative' : 'text-accent-yellow'
            )}>
              {sentiment.label}
            </p>
            <p className="text-xs text-gray-500">{Math.round(sentiment.confidence * 100)}% confidence</p>
          </div>
          <div className="card">
            <p className="stat-label text-brand-green">Bullish</p>
            <p className="text-2xl font-bold text-brand-green">{bullishCount}</p>
            <p className="text-xs text-gray-500">articles</p>
          </div>
          <div className="card">
            <p className="stat-label text-accent-red">Bearish</p>
            <p className="text-2xl font-bold text-accent-red">{bearishCount}</p>
            <p className="text-xs text-gray-500">articles</p>
          </div>
          <div className="card">
            <p className="stat-label">Neutral</p>
            <p className="text-2xl font-bold text-gray-400">{neutralCount}</p>
            <p className="text-xs text-gray-500">articles</p>
          </div>
        </div>
      )}

      {/* Top headlines sentiment bar */}
      {articles.length > 0 && (
        <div className="card">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">News Sentiment Distribution</p>
          <div className="h-3 bg-dark-surface rounded-full overflow-hidden flex">
            <div
              className="bg-brand-green h-full transition-all"
              style={{ width: `${(bullishCount / articles.length) * 100}%` }}
            />
            <div
              className="bg-gray-600 h-full transition-all"
              style={{ width: `${(neutralCount / articles.length) * 100}%` }}
            />
            <div
              className="bg-accent-red h-full transition-all"
              style={{ width: `${(bearishCount / articles.length) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span className="text-brand-green">{Math.round((bullishCount / articles.length) * 100) || 0}% Bullish</span>
            <span className="text-gray-400">{Math.round((neutralCount / articles.length) * 100) || 0}% Neutral</span>
            <span className="text-accent-red">{Math.round((bearishCount / articles.length) * 100) || 0}% Bearish</span>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(({ label, value, Icon, cls }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border',
              filter === value
                ? 'bg-dark-surface border-dark-border text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            )}
          >
            <Icon size={14} className={cls} />
            {label}
            <span className="text-xs text-gray-600 bg-dark-surface px-1.5 py-0.5 rounded-full">
              {value === 'ALL' ? articles.length : value === 'BULLISH' ? bullishCount : value === 'BEARISH' ? bearishCount : neutralCount}
            </span>
          </button>
        ))}
      </div>

      {/* Articles grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((article: NewsArticle, i: number) => (
            <NewsCard key={i} article={article} />
          ))}
          {!filtered.length && (
            <div className="col-span-2 text-center py-12 text-gray-500">
              No {filter.toLowerCase()} news found
            </div>
          )}
        </div>
      )}
    </div>
  )
}
