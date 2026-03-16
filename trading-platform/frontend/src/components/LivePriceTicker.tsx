import { useEffect, useRef } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useMarketStore } from '../store'

const TICKER_SYMBOLS = [
  'NVDA', 'AAPL', 'MSFT', 'TSLA', 'META', 'GOOGL', 'AMZN', 'JPM',
  'BTC-USD', 'ETH-USD', 'SOL-USD',
  'RELIANCE.NS', 'TCS.NS', 'INFY.NS',
]

export default function LivePriceTicker() {
  const liveQuotes = useMarketStore((s) => s.liveQuotes)
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let pos = 0
    const id = setInterval(() => {
      pos += 0.5
      if (pos >= el.scrollWidth / 2) pos = 0
      el.scrollLeft = pos
    }, 30)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="bg-[#0d1117] border-b border-[#21262d] overflow-hidden relative" style={{ height: 32 }}>
      <div
        ref={scrollRef}
        className="flex items-center gap-6 px-4 h-full overflow-hidden whitespace-nowrap"
        style={{ scrollBehavior: 'auto' }}
      >
        {/* Duplicate for seamless scroll */}
        {[...TICKER_SYMBOLS, ...TICKER_SYMBOLS].map((sym, i) => {
          const q = liveQuotes[sym]
          const price = q?.price
          const chg = q?.change_pct ?? 0
          const up = chg >= 0

          return (
            <button
              key={`${sym}-${i}`}
              onClick={() => setSelectedSymbol(sym)}
              className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity flex-shrink-0"
            >
              <span className="text-gray-400 font-medium">{sym.replace('.NS', '').replace('-USD', '')}</span>
              {price ? (
                <>
                  <span className="text-white font-mono">
                    {price >= 1000 ? price.toLocaleString('en', { maximumFractionDigits: 0 }) : price.toFixed(2)}
                  </span>
                  <span className={`flex items-center gap-0.5 ${up ? 'text-green-400' : 'text-red-400'}`}>
                    {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {Math.abs(chg).toFixed(2)}%
                  </span>
                </>
              ) : (
                <span className="text-gray-600">—</span>
              )}
            </button>
          )
        })}
      </div>
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0d1117] to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0d1117] to-transparent pointer-events-none" />
    </div>
  )
}
