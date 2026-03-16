import { useEffect, useState } from 'react'
import { Activity, TrendingUp, TrendingDown, Zap, RefreshCw } from 'lucide-react'
import { useMarketStore, useAutoTraderStore } from '../store'
import LiveCandleChart from '../components/LiveCandleChart'
import QuickTradePanel from '../components/QuickTradePanel'
import WatchlistSidebar from '../components/WatchlistSidebar'
import GoalProgressCard from '../components/GoalProgressCard'
import AgentLogFeed from '../components/AgentLogFeed'
import { autoTraderApi } from '../services/api'

export default function Dashboard() {
  const { liveQuotes, selectedSymbol } = useMarketStore()
  const { opportunities, setOpportunities, isActive } = useAutoTraderStore()
  const [loadingOpps, setLoadingOpps] = useState(false)

  const loadOpportunities = async () => {
    setLoadingOpps(true)
    try {
      const res = await autoTraderApi.opportunities()
      setOpportunities(res.opportunities || [])
    } catch { /* silent */ }
    finally { setLoadingOpps(false) }
  }

  useEffect(() => {
    loadOpportunities()
    const id = setInterval(loadOpportunities, 15_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex gap-0 overflow-hidden" style={{ height: 'calc(100vh - 96px)' }}>
      {/* Left: Watchlist */}
      <WatchlistSidebar />

      {/* Center: Chart + Opportunities */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Live chart */}
        <div className="flex overflow-hidden" style={{ height: '60%' }}>
          <LiveCandleChart />
        </div>

        {/* Bottom: Opportunities + Agent Log */}
        <div className="border-t border-[#21262d] flex overflow-hidden" style={{ height: '40%' }}>
          {/* Scanner Opportunities */}
          <div className="w-1/2 border-r border-[#21262d] flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#21262d]">
              <span className="text-xs font-semibold text-gray-400 flex items-center gap-2">
                <Activity className="w-3 h-3 text-purple-400" /> Scanner Opportunities
              </span>
              <button onClick={loadOpportunities} disabled={loadingOpps} className="text-gray-500 hover:text-white">
                <RefreshCw className={`w-3 h-3 ${loadingOpps ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-1.5 space-y-1">
              {opportunities.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-4">Scanning market...</p>
              ) : (
                opportunities.slice(0, 8).map((opp: any) => {
                  const up = opp.direction === 'BULLISH'
                  return (
                    <div
                      key={opp.symbol}
                      onClick={() => useMarketStore.getState().setSelectedSymbol(opp.symbol)}
                      className="flex items-center justify-between px-2.5 py-1.5 bg-[#161b22] hover:bg-[#21262d] rounded cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${up ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="text-xs font-mono font-semibold text-white">
                          {opp.symbol?.replace('.NS', '').replace('-USD', '')}
                        </span>
                        <span className={`text-xs ${up ? 'text-green-400' : 'text-red-400'}`}>
                          {(opp.change_pct ?? 0) >= 0 ? '+' : ''}{(opp.change_pct ?? 0).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">str={opp.signal_strength?.toFixed(1)}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          up ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        }`}>{up ? 'BULL' : 'BEAR'}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Agent Log */}
          <div className="w-1/2 flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[#21262d]">
              <span className="text-xs font-semibold text-gray-400 flex items-center gap-2">
                <Zap className="w-3 h-3 text-blue-400" /> Agent Activity
              </span>
              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse ml-auto" />}
            </div>
            <div className="flex-1 overflow-hidden p-1.5">
              <AgentLogFeed maxHeight={180} />
            </div>
          </div>
        </div>
      </div>

      {/* Right: Trade panel + Goal */}
      <div className="flex flex-col border-l border-[#21262d]">
        <QuickTradePanel />
        <div className="p-3 border-t border-[#21262d]">
          <GoalProgressCard />
        </div>
      </div>
    </div>
  )
}
