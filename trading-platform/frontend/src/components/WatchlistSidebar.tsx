import { useState } from 'react'
import { Plus, X, TrendingUp, TrendingDown, Search } from 'lucide-react'
import { useMarketStore } from '../store'

const ALL_SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'GOOGL', 'AMZN', 'JPM', 'V', 'SPY', 'QQQ',
  'BTC-USD', 'ETH-USD', 'BNB-USD', 'SOL-USD', 'XRP-USD', 'DOGE-USD',
  'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS', 'SBIN.NS',
]

function Sparkline({ prices }: { prices: number[] }) {
  if (prices.length < 2) return <div className="w-12 h-6" />
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const w = 48, h = 24
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w
    const y = h - ((p - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  const up = prices[prices.length - 1] >= prices[0]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function WatchlistSidebar() {
  const { liveQuotes, watchlist, selectedSymbol, setSelectedSymbol, addToWatchlist, removeFromWatchlist, priceHistory } = useMarketStore()
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const filtered = ALL_SYMBOLS.filter(s =>
    !watchlist.includes(s) && s.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <aside className="w-56 bg-[#0d1117] border-r border-[#21262d] flex flex-col h-full overflow-hidden flex-shrink-0">
      <div className="p-3 border-b border-[#21262d] flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Watchlist</span>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          {showSearch ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>

      {showSearch && (
        <div className="p-2 border-b border-[#21262d]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Add symbol..."
              className="w-full bg-[#161b22] text-xs text-white pl-6 pr-2 py-1.5 rounded border border-[#30363d] focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          {search && (
            <div className="mt-1 max-h-32 overflow-y-auto">
              {filtered.slice(0, 6).map(sym => (
                <button
                  key={sym}
                  onClick={() => { addToWatchlist(sym); setSearch(''); setShowSearch(false) }}
                  className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-[#21262d] rounded"
                >
                  {sym}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {watchlist.map((sym) => {
          const q = liveQuotes[sym]
          const price = q?.price
          const chg = q?.change_pct ?? 0
          const up = chg >= 0
          const history = priceHistory[sym] || []
          const isSelected = selectedSymbol === sym

          return (
            <button
              key={sym}
              onClick={() => setSelectedSymbol(sym)}
              className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors group border-l-2 ${
                isSelected
                  ? 'bg-[#161b22] border-blue-500 text-white'
                  : 'border-transparent hover:bg-[#161b22] text-gray-300'
              }`}
            >
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="text-xs font-semibold truncate w-full">{sym.replace('.NS', '').replace('-USD', '')}</span>
                {price ? (
                  <span className={`text-xs font-mono ${up ? 'text-green-400' : 'text-red-400'}`}>
                    {up ? '+' : ''}{chg.toFixed(2)}%
                  </span>
                ) : (
                  <span className="text-xs text-gray-600">—</span>
                )}
              </div>

              <div className="flex items-center gap-2 ml-2">
                <Sparkline prices={history} />
                <div className="flex flex-col items-end">
                  {price ? (
                    <span className="text-xs font-mono text-white">
                      {price >= 10000 ? price.toLocaleString('en', {maximumFractionDigits: 0}) : price.toFixed(2)}
                    </span>
                  ) : null}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFromWatchlist(sym) }}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all ml-1"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
