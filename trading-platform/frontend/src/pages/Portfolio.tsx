import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { RefreshCw, TrendingUp, TrendingDown, Briefcase, Clock, Bot } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { tradingApi } from '../services/api'
import { useAuthStore } from '../store'
import PortfolioChart from '../components/PortfolioChart'
import type { Trade } from '../types'
import { formatDistanceToNow } from 'date-fns'

function PositionRow({ pos }: { pos: any }) {
  const isPositive = pos.unrealized_pnl >= 0
  return (
    <tr className="border-b border-dark-border/50 hover:bg-dark-hover/30 transition-colors">
      <td className="px-4 py-3">
        <p className="font-semibold text-sm">{pos.symbol.replace('.NS', '').replace('-USD', '')}</p>
        <p className="text-xs text-gray-500">{pos.market}</p>
      </td>
      <td className="px-3 py-3 text-right font-mono text-sm">{pos.quantity.toFixed(4)}</td>
      <td className="px-3 py-3 text-right font-mono text-sm">${pos.avg_cost?.toFixed(2)}</td>
      <td className="px-3 py-3 text-right font-mono text-sm">${pos.current_price?.toFixed(2)}</td>
      <td className="px-3 py-3 text-right font-mono text-sm">${pos.market_value?.toFixed(2)}</td>
      <td className="px-3 py-3 text-right">
        <p className={clsx('text-sm font-semibold', isPositive ? 'positive' : 'negative')}>
          {isPositive ? '+' : ''}${pos.unrealized_pnl?.toFixed(2)}
        </p>
        <p className={clsx('text-xs', isPositive ? 'positive' : 'negative')}>
          {isPositive ? '+' : ''}{pos.unrealized_pnl_pct?.toFixed(2)}%
        </p>
      </td>
    </tr>
  )
}

function TradeRow({ trade }: { trade: Trade }) {
  const isBuy = trade.action === 'BUY'
  return (
    <tr className="border-b border-dark-border/50 hover:bg-dark-hover/30 transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', isBuy ? 'badge-buy' : 'badge-sell')}>
            {trade.action}
          </span>
          {trade.is_ai_trade && (
            <span className="bg-accent-purple/20 text-accent-purple text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Bot size={10} />AI
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 text-sm font-semibold">{trade.symbol.replace('.NS', '').replace('-USD', '')}</td>
      <td className="px-3 py-2.5 text-sm font-mono text-right">{trade.quantity.toFixed(4)}</td>
      <td className="px-3 py-2.5 text-sm font-mono text-right">${trade.price?.toFixed(2)}</td>
      <td className="px-3 py-2.5 text-sm font-mono text-right">${trade.total_value?.toFixed(2)}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 text-right">
        {trade.timestamp ? formatDistanceToNow(new Date(trade.timestamp), { addSuffix: true }) : '—'}
      </td>
    </tr>
  )
}

export default function Portfolio() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: tradingApi.portfolio,
    enabled: !!user,
    refetchInterval: 60_000,
  })

  const { data: trades = [] } = useQuery({
    queryKey: ['trade-history'],
    queryFn: () => tradingApi.history(50),
    enabled: !!user,
  })

  const refreshMutation = useMutation({
    mutationFn: tradingApi.refreshPrices,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4 text-center">
        <Briefcase size={48} className="text-gray-700" />
        <h2 className="text-xl font-semibold">Sign in to view your portfolio</h2>
        <p className="text-gray-500">Start with $100,000 in paper trading funds</p>
        <button onClick={() => navigate('/login')} className="btn-primary">
          Sign In
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!portfolio) return null

  const pnlPositive = portfolio.total_pnl >= 0

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Portfolio</h1>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="btn-secondary text-sm py-2 flex items-center gap-2"
        >
          <RefreshCw size={14} className={clsx(refreshMutation.isPending && 'animate-spin')} />
          Refresh Prices
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card col-span-2 sm:col-span-1">
          <p className="stat-label">Total Value</p>
          <p className="text-2xl font-bold font-mono">
            ${portfolio.total_value?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card">
          <p className="stat-label">Total P&L</p>
          <p className={clsx('text-xl font-bold font-mono', pnlPositive ? 'positive' : 'negative')}>
            {pnlPositive ? '+' : ''}${portfolio.total_pnl?.toFixed(2)}
          </p>
          <p className={clsx('text-xs', pnlPositive ? 'positive' : 'negative')}>
            {pnlPositive ? '+' : ''}{portfolio.total_pnl_pct?.toFixed(2)}%
          </p>
        </div>
        <div className="card">
          <p className="stat-label">Cash</p>
          <p className="text-xl font-bold font-mono">${portfolio.cash_balance?.toFixed(2)}</p>
        </div>
        <div className="card">
          <p className="stat-label">Invested</p>
          <p className="text-xl font-bold font-mono">${portfolio.invested_value?.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Allocation chart */}
        <div className="card">
          <h2 className="font-semibold mb-4">Allocation</h2>
          {portfolio.positions?.length > 0 || portfolio.cash_balance > 0 ? (
            <PortfolioChart portfolio={portfolio} />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No positions yet</p>
              <Link to="/markets" className="text-brand-green text-sm hover:underline mt-2 block">
                Start trading →
              </Link>
            </div>
          )}
        </div>

        {/* Positions table */}
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          <div className="p-4 border-b border-dark-border">
            <h2 className="font-semibold">Open Positions ({portfolio.positions_count})</h2>
          </div>
          {portfolio.positions?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-dark-border">
                    {['Symbol', 'Qty', 'Avg Cost', 'Curr Price', 'Mkt Value', 'P&L'].map(h => (
                      <th key={h} className={clsx('px-3 py-2', h === 'Symbol' ? 'text-left pl-4' : 'text-right')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {portfolio.positions.map((p: any) => (
                    <PositionRow key={p.symbol} pos={p} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Briefcase size={32} className="mx-auto mb-3 text-gray-700" />
              <p>No open positions</p>
              <Link to="/markets" className="text-brand-green text-sm hover:underline mt-2 block">
                Browse markets →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Trade history */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-dark-border flex items-center gap-2">
          <Clock size={16} className="text-gray-400" />
          <h2 className="font-semibold">Trade History</h2>
        </div>
        {trades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-dark-border">
                  {['Type', 'Symbol', 'Qty', 'Price', 'Total', 'Time'].map(h => (
                    <th key={h} className={clsx('px-3 py-2', h === 'Type' ? 'text-left pl-4' : 'text-right')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((t: Trade) => (
                  <TradeRow key={t.id} trade={t} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Clock size={24} className="mx-auto mb-2 text-gray-700" />
            <p>No trades yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
