import { useQuery } from '@tanstack/react-query'
import { marketApi } from '../services/api'
import { clsx } from 'clsx'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { Quote } from '../types'

const TICKER_SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META',
  'BTC-USD', 'ETH-USD', 'SOL-USD',
  'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS',
]

function TickerItem({ quote }: { quote: Quote }) {
  const isPositive = quote.change_pct >= 0
  return (
    <div className="inline-flex items-center gap-2 px-4 border-r border-dark-border/50">
      <span className="text-sm font-medium text-gray-300">{quote.symbol.replace('.NS', '').replace('-USD', '')}</span>
      <span className="text-sm font-mono">
        {quote.price < 1000 ? `$${quote.price.toFixed(2)}` : `$${quote.price.toFixed(0)}`}
      </span>
      <span className={clsx('flex items-center gap-0.5 text-xs font-medium', isPositive ? 'text-brand-green' : 'text-accent-red')}>
        {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {isPositive ? '+' : ''}{quote.change_pct.toFixed(2)}%
      </span>
    </div>
  )
}

export default function MarketTicker() {
  const { data: quotes = [] } = useQuery({
    queryKey: ['ticker-quotes'],
    queryFn: () => marketApi.quotes(TICKER_SYMBOLS),
    refetchInterval: 30_000,
  })

  if (!quotes.length) return null

  const doubled = [...quotes, ...quotes]

  return (
    <div className="bg-dark-card/60 border-b border-dark-border overflow-hidden h-9 flex items-center">
      <div className="ticker-wrap flex-1">
        <div className="ticker-inner flex items-center">
          {doubled.map((q: Quote, i: number) => (
            <TickerItem key={`${q.symbol}-${i}`} quote={q} />
          ))}
        </div>
      </div>
      <div className="flex-shrink-0 px-4 text-xs text-gray-600 border-l border-dark-border">LIVE</div>
    </div>
  )
}
