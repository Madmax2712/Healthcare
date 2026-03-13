import { clsx } from 'clsx'
import { ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { NewsArticle } from '../types'

interface Props {
  article: NewsArticle
  compact?: boolean
}

function SentimentIcon({ label }: { label: string }) {
  if (label === 'BULLISH') return <TrendingUp size={13} className="text-brand-green" />
  if (label === 'BEARISH') return <TrendingDown size={13} className="text-accent-red" />
  return <Minus size={13} className="text-gray-400" />
}

function SentimentBadge({ label, score }: { label: string; score: number }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full',
      label === 'BULLISH' ? 'badge-bullish' :
      label === 'BEARISH' ? 'badge-bearish' : 'badge-neutral'
    )}>
      <SentimentIcon label={label} />
      {label}
      <span className="opacity-70">({score >= 0 ? '+' : ''}{score.toFixed(2)})</span>
    </span>
  )
}

export default function NewsCard({ article, compact }: Props) {
  const timeAgo = article.publishedAt
    ? formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
    : 'recently'

  if (compact) {
    return (
      <div className="flex gap-3 py-3 border-b border-dark-border last:border-0 hover:bg-dark-hover/30 transition-colors rounded-lg px-2 cursor-pointer group">
        <div className={clsx(
          'w-1 flex-shrink-0 rounded-full mt-1',
          article.sentiment_label === 'BULLISH' ? 'bg-brand-green' :
          article.sentiment_label === 'BEARISH' ? 'bg-accent-red' : 'bg-gray-600'
        )} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200 line-clamp-2 leading-snug group-hover:text-white transition-colors">
            {article.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-600">{article.source?.name}</span>
            <span className="text-gray-700">·</span>
            <span className="text-xs text-gray-600">{timeAgo}</span>
          </div>
        </div>
        <SentimentBadge label={article.sentiment_label} score={article.sentiment_score} />
      </div>
    )
  }

  return (
    <div className="card hover:border-dark-border/80 transition-all group animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500">{article.source?.name}</span>
            <span className="text-gray-700">·</span>
            <span className="text-xs text-gray-600">{timeAgo}</span>
            <SentimentBadge label={article.sentiment_label} score={article.sentiment_score} />
          </div>
          <h3 className="text-sm font-semibold text-white leading-snug mb-1 group-hover:text-brand-green/90 transition-colors">
            {article.title}
          </h3>
          {article.description && (
            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
              {article.description}
            </p>
          )}
        </div>
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-gray-600 hover:text-brand-green transition-colors mt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      {/* Sentiment score bar */}
      <div className="mt-3 h-1 bg-dark-surface rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-all',
            article.sentiment_label === 'BULLISH' ? 'bg-brand-green' :
            article.sentiment_label === 'BEARISH' ? 'bg-accent-red' : 'bg-gray-600'
          )}
          style={{
            width: `${Math.abs(article.sentiment_score) * 100}%`,
            marginLeft: article.sentiment_score >= 0 ? '50%' : `${50 - Math.abs(article.sentiment_score) * 50}%`,
          }}
        />
      </div>
    </div>
  )
}
