import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { Search, TrendingUp, TrendingDown, Star, StarOff, Zap, BarChart2 } from 'lucide-react'
import { marketApi, aiApi, newsApi } from '../services/api'
import { useMarketStore } from '../store'
import StockChart from '../components/StockChart'
import AISignalCard from '../components/AISignalCard'
import TradingPanel from '../components/TradingPanel'
import NewsCard from '../components/NewsCard'
import type { Quote, MarketType, NewsArticle } from '../types'

const MARKETS: { label: string; value: MarketType; flag: string }[] = [
  { label: 'US Stocks', value: 'US', flag: '🇺🇸' },
  { label: 'India', value: 'INDIA', flag: '🇮🇳' },
  { label: 'Crypto', value: 'CRYPTO', flag: '₿' },
]

function QuoteRow({ quote, selected, onSelect }: { quote: Quote; selected: boolean; onSelect: () => void }) {
  const { watchlist, addToWatchlist, removeFromWatchlist } = useMarketStore()
  const inWatchlist = watchlist.includes(quote.symbol)
  const isPositive = quote.change_pct >= 0

  return (
    <tr
      onClick={onSelect}
      className={clsx(
        'border-b border-dark-border/50 hover:bg-dark-hover/40 cursor-pointer transition-all',
        selected && 'bg-brand-green/5 border-l-2 border-l-brand-green'
      )}
    >
      <td className="px-4 py-3">
        <button
          onClick={(e) => {
            e.stopPropagation()
            inWatchlist ? removeFromWatchlist(quote.symbol) : addToWatchlist(quote.symbol)
          }}
          className="text-gray-600 hover:text-accent-yellow transition-colors"
        >
          {inWatchlist ? <Star size={14} fill="currentColor" className="text-accent-yellow" /> : <StarOff size={14} />}
        </button>
      </td>
      <td className="px-3 py-3">
        <p className="font-semibold text-sm">{quote.symbol.replace('.NS', '').replace('-USD', '')}</p>
        <p className="text-xs text-gray-500 truncate max-w-[120px]">{quote.name}</p>
      </td>
      <td className="px-3 py-3 text-right font-mono text-sm">
        ${quote.price?.toFixed(quote.price >= 100 ? 2 : 4) ?? '—'}
      </td>
      <td className="px-3 py-3 text-right">
        <span className={clsx('text-sm flex items-center justify-end gap-0.5', isPositive ? 'positive' : 'negative')}>
          {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {isPositive ? '+' : ''}{quote.change_pct?.toFixed(2)}%
        </span>
      </td>
      <td className="px-3 py-3 text-right text-xs text-gray-500 hidden sm:table-cell">
        {quote.volume ? `${(quote.volume / 1_000_000).toFixed(1)}M` : '—'}
      </td>
    </tr>
  )
}

export default function Markets() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { selectedMarket, setMarket, liveQuotes } = useMarketStore()
  const [search, setSearch] = useState('')
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'chart' | 'signal' | 'news'>('chart')

  // Support URL params
  useEffect(() => {
    const sym = searchParams.get('symbol')
    const mkt = searchParams.get('market') as MarketType
    if (sym) setSelectedSymbol(sym)
    if (mkt && ['US', 'INDIA', 'CRYPTO'].includes(mkt)) setMarket(mkt)
  }, [])

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['screener', selectedMarket],
    queryFn: () => marketApi.screener(selectedMarket),
    refetchInterval: 60_000,
  })

  const { data: signal, isLoading: signalLoading } = useQuery({
    queryKey: ['signal', selectedSymbol, selectedMarket],
    queryFn: () => aiApi.signal(selectedSymbol!, selectedMarket),
    enabled: !!selectedSymbol && activeTab === 'signal',
    staleTime: 120_000,
  })

  const { data: symbolNews = [] } = useQuery({
    queryKey: ['symbol-news', selectedSymbol],
    queryFn: () => newsApi.symbol(selectedSymbol!, 8),
    enabled: !!selectedSymbol && activeTab === 'news',
    staleTime: 180_000,
  })

  const { data: selectedQuote } = useQuery({
    queryKey: ['quote', selectedSymbol],
    queryFn: () => marketApi.quote(selectedSymbol!),
    enabled: !!selectedSymbol,
    refetchInterval: 30_000,
  })

  // Merge live quotes with fetched
  const mergedQuotes: Quote[] = quotes.map((q: Quote) => liveQuotes[q.symbol] || q)

  const filtered = mergedQuotes.filter((q: Quote) => {
    const s = search.toLowerCase()
    return (
      q.symbol.toLowerCase().includes(s) ||
      q.name?.toLowerCase().includes(s)
    )
  })

  const selectedQuoteData = selectedQuote || mergedQuotes.find((q: Quote) => q.symbol === selectedSymbol)
  const isPositive = (selectedQuoteData?.change_pct || 0) >= 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Markets</h1>
      </div>

      {/* Market tabs */}
      <div className="flex gap-2 flex-wrap">
        {MARKETS.map(({ label, value, flag }) => (
          <button
            key={value}
            onClick={() => { setMarket(value); setSelectedSymbol(null) }}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              selectedMarket === value
                ? 'bg-brand-green/15 text-brand-green border border-brand-green/30'
                : 'bg-dark-surface text-gray-400 hover:text-white border border-dark-border'
            )}
          >
            <span>{flag}</span>
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Stock list */}
        <div className="xl:col-span-2 card p-0 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-dark-border">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-9 py-2 text-sm"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-dark-card">
                <tr className="text-xs text-gray-500 border-b border-dark-border">
                  <th className="px-4 py-2 text-left w-8"></th>
                  <th className="px-3 py-2 text-left">Symbol</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Change</th>
                  <th className="px-3 py-2 text-right hidden sm:table-cell">Volume</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-600">Loading...</td></tr>
                ) : filtered.map((q: Quote) => (
                  <QuoteRow
                    key={q.symbol}
                    quote={q}
                    selected={q.symbol === selectedSymbol}
                    onSelect={() => setSelectedSymbol(q.symbol)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        <div className="xl:col-span-3 space-y-4">
          {selectedSymbol && selectedQuoteData ? (
            <>
              {/* Quote header */}
              <div className="card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedQuoteData.name || selectedSymbol}</h2>
                    <p className="text-gray-500 text-sm">{selectedSymbol} · {selectedMarket}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold font-mono">
                      ${selectedQuoteData.price?.toFixed(2) ?? '—'}
                    </p>
                    <p className={clsx('flex items-center justify-end gap-1 text-sm font-medium', isPositive ? 'positive' : 'negative')}>
                      {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {isPositive ? '+' : ''}{selectedQuoteData.change_pct?.toFixed(2)}%
                      <span className="text-gray-500 font-normal">today</span>
                    </p>
                  </div>
                </div>

                {/* Key stats */}
                <div className="grid grid-cols-3 gap-3 text-sm border-t border-dark-border pt-3">
                  {[
                    { label: 'Volume', value: selectedQuoteData.volume ? `${(selectedQuoteData.volume / 1_000_000).toFixed(1)}M` : '—' },
                    { label: '52W High', value: selectedQuoteData.high_52w ? `$${selectedQuoteData.high_52w?.toFixed(2)}` : '—' },
                    { label: '52W Low', value: selectedQuoteData.low_52w ? `$${selectedQuoteData.low_52w?.toFixed(2)}` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center">
                      <p className="text-gray-500 text-xs">{label}</p>
                      <p className="font-semibold font-mono">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tab buttons */}
              <div className="flex gap-2">
                {[
                  { key: 'chart', label: 'Chart', Icon: BarChart2 },
                  { key: 'signal', label: 'AI Signal', Icon: Zap },
                  { key: 'news', label: 'News', Icon: null },
                ].map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key as 'chart' | 'signal' | 'news')}
                    className={clsx(
                      'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                      activeTab === key
                        ? 'bg-brand-green/15 text-brand-green'
                        : 'bg-dark-surface text-gray-400 hover:text-white'
                    )}
                  >
                    {Icon && <Icon size={14} />}
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === 'chart' && (
                <div className="card">
                  <StockChart symbol={selectedSymbol} currentPrice={selectedQuoteData.price} />
                </div>
              )}

              {activeTab === 'signal' && (
                <div>
                  {signalLoading ? (
                    <div className="card flex items-center justify-center h-32">
                      <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : signal ? (
                    <AISignalCard signal={signal} />
                  ) : (
                    <div className="card text-center text-gray-500">No signal data</div>
                  )}
                </div>
              )}

              {activeTab === 'news' && (
                <div className="space-y-2">
                  {symbolNews.map((a: NewsArticle, i: number) => (
                    <NewsCard key={i} article={a} />
                  ))}
                  {!symbolNews.length && (
                    <div className="card text-center text-gray-500">No news available</div>
                  )}
                </div>
              )}

              {/* Trading panel always visible */}
              <TradingPanel
                symbol={selectedSymbol}
                market={selectedMarket}
                quote={selectedQuoteData}
              />
            </>
          ) : (
            <div className="card flex flex-col items-center justify-center h-64 text-center">
              <BarChart2 size={32} className="text-gray-700 mb-3" />
              <p className="text-gray-500">Select a symbol to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
