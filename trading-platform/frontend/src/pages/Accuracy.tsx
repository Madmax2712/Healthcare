import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend
} from 'recharts'
import { api } from '../services/api'
import { Target, TrendingUp, AlertCircle, CheckCircle, Layers, BarChart2 } from 'lucide-react'

const backtestApi = {
  accuracyReport: () => api.get('/backtest/accuracy-report').then(r => r.data),
  runBacktest: (symbol: string, market: string, period = '6mo') =>
    api.get(`/backtest/run/${symbol}?market=${market}&period=${period}`).then(r => r.data),
}

function MetricCard({ label, value, sub, color = 'white' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card">
      <p className="stat-label mb-1">{label}</p>
      <p className={clsx('text-2xl font-bold', color === 'green' ? 'positive' : color === 'red' ? 'negative' : '')}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function LayerStatus({ name, passed, detail }: { name: string; passed: boolean; detail?: string }) {
  return (
    <div className={clsx(
      'flex items-start gap-3 p-3 rounded-xl border transition-all',
      passed ? 'bg-brand-green/5 border-brand-green/20' : 'bg-dark-surface border-dark-border'
    )}>
      {passed
        ? <CheckCircle size={16} className="text-brand-green mt-0.5 flex-shrink-0" />
        : <AlertCircle size={16} className="text-gray-600 mt-0.5 flex-shrink-0" />
      }
      <div>
        <p className={clsx('text-sm font-medium', passed ? 'text-white' : 'text-gray-500')}>{name}</p>
        {detail && <p className="text-xs text-gray-600 mt-0.5">{detail}</p>}
      </div>
    </div>
  )
}

const LAYERS = [
  { name: 'L1 — News Sentiment', detail: 'VADER + financial lexicon on 20+ articles' },
  { name: 'L2 — Technical Analysis', detail: 'RSI, MACD, Bollinger Bands, EMA crossover' },
  { name: 'L3 — Price Prediction', detail: 'Statistical trend + momentum model' },
  { name: 'L4 — Ensemble (5 models)', detail: 'Momentum, trend-follow, oscillator, volume, pattern — ≥4/5 must agree' },
  { name: 'L5 — Market Regime', detail: 'Bull/Bear/Ranging/Volatile — only trade with the regime' },
  { name: 'L6 — Risk/Reward Gate', detail: 'Minimum 1.8:1 R:R required — bad setups are rejected' },
  { name: 'L7 — Direction Consensus', detail: '60%+ of active signals must agree on BUY or SELL' },
]

export default function Accuracy() {
  const [backtestSymbol, setBacktestSymbol] = useState('AAPL')
  const [backtestMarket, setBacktestMarket] = useState('US')
  const [backtestPeriod, setBacktestPeriod] = useState('6mo')
  const [runningBacktest, setRunningBacktest] = useState(false)
  const [backtestResult, setBacktestResult] = useState<any>(null)

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['accuracy-report'],
    queryFn: backtestApi.accuracyReport,
    staleTime: 600_000,
  })

  const handleRunBacktest = async () => {
    setRunningBacktest(true)
    setBacktestResult(null)
    try {
      const result = await backtestApi.runBacktest(backtestSymbol, backtestMarket, backtestPeriod)
      setBacktestResult(result)
    } catch (err) {
      console.error(err)
    } finally {
      setRunningBacktest(false)
    }
  }

  const equityCurve = backtestResult?.equity_curve?.map((v: number, i: number) => ({
    trade: i,
    equity: round2(v * 100),
  })) || []

  const tradeResults = backtestResult?.recent_trades?.map((t: any) => ({
    date: t.entry_date?.slice(0, 10),
    return_pct: t.return_pct,
    win: t.is_win,
  })) || []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Target size={20} className="text-brand-green" />
          AI Accuracy & Backtesting
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Validate signal quality against historical data before trusting live signals
        </p>
      </div>

      {/* How accuracy works */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-accent-blue" />
          <h2 className="font-semibold">7-Layer Signal Filter — How High Accuracy Is Achieved</h2>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">
          A BUY or SELL signal is only generated when <strong className="text-white">5 or more of 7 independent layers</strong> agree.
          This extreme selectivity means the system trades <em>less often</em> but with much higher precision.
          When all 7 layers align, the signal has historically been most reliable.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {LAYERS.map((layer, i) => (
            <LayerStatus key={i} name={layer.name} passed detail={layer.detail} />
          ))}
        </div>
        <div className="bg-accent-yellow/10 border border-accent-yellow/20 rounded-xl p-3 text-sm text-accent-yellow">
          <strong>Honest disclaimer:</strong> No algorithm can guarantee 95% accuracy consistently.
          Markets are unpredictable. This system targets <strong>high selectivity</strong>
          — only signaling when conditions are strongly aligned. Fewer signals = higher quality.
          Always use stop-losses and never risk more than you can afford to lose.
        </div>
      </div>

      {/* Historical accuracy summary */}
      {reportLoading ? (
        <div className="card flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : report && (
        <div className="space-y-4">
          <h2 className="font-semibold">Historical Accuracy Report (6-month backtest)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Avg Win Rate"
              value={`${(report.summary?.avg_win_rate * 100)?.toFixed(1)}%`}
              sub={`${report.summary?.total_trades} total trades`}
              color={report.summary?.avg_win_rate >= 0.6 ? 'green' : 'red'}
            />
            <MetricCard
              label="Profit Factor"
              value={report.summary?.avg_profit_factor?.toFixed(2)}
              sub=">1 = profitable"
              color={report.summary?.avg_profit_factor >= 1.5 ? 'green' : 'white'}
            />
            <MetricCard
              label="Avg Sharpe"
              value={report.summary?.avg_sharpe_ratio?.toFixed(2)}
              sub=">1 = good"
              color={report.summary?.avg_sharpe_ratio >= 1.0 ? 'green' : 'white'}
            />
            <MetricCard
              label="Symbols Tested"
              value={String(report.summary?.symbols_tested)}
              sub="US + India + Crypto"
            />
          </div>

          {/* Per-symbol table */}
          <div className="card p-0 overflow-hidden">
            <div className="p-3 border-b border-dark-border">
              <h3 className="font-semibold text-sm">By Symbol</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-dark-border">
                    {['Symbol', 'Market', 'Trades', 'Win Rate', 'P. Factor', 'Sharpe', 'Total Return'].map(h => (
                      <th key={h} className={clsx('px-4 py-2', h === 'Symbol' ? 'text-left' : 'text-right')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(report.by_symbol || []).map((r: any) => (
                    <tr key={r.symbol} className="border-b border-dark-border/50 hover:bg-dark-hover/30">
                      <td className="px-4 py-2 font-semibold">{r.symbol.replace('.NS','').replace('-USD','')}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{r.market}</td>
                      <td className="px-4 py-2 text-right">{r.total_trades}</td>
                      <td className={clsx('px-4 py-2 text-right font-semibold', r.win_rate >= 0.6 ? 'positive' : 'negative')}>
                        {(r.win_rate * 100).toFixed(1)}%
                      </td>
                      <td className={clsx('px-4 py-2 text-right', r.profit_factor >= 1.5 ? 'positive' : '')}>
                        {r.profit_factor?.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right">{r.sharpe_ratio?.toFixed(2)}</td>
                      <td className={clsx('px-4 py-2 text-right font-semibold', r.total_return_pct >= 0 ? 'positive' : 'negative')}>
                        {r.total_return_pct >= 0 ? '+' : ''}{r.total_return_pct?.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Custom backtest runner */}
      <div className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <BarChart2 size={16} className="text-brand-green" />
          Run Custom Backtest
        </h2>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={backtestSymbol}
            onChange={e => setBacktestSymbol(e.target.value.toUpperCase())}
            placeholder="Symbol (e.g. AAPL)"
            className="input-field flex-1 min-w-[150px]"
          />
          <select
            value={backtestMarket}
            onChange={e => setBacktestMarket(e.target.value)}
            className="input-field w-32"
          >
            <option value="US">US</option>
            <option value="INDIA">India</option>
            <option value="CRYPTO">Crypto</option>
          </select>
          <select
            value={backtestPeriod}
            onChange={e => setBacktestPeriod(e.target.value)}
            className="input-field w-28"
          >
            <option value="3mo">3 months</option>
            <option value="6mo">6 months</option>
            <option value="1y">1 year</option>
            <option value="2y">2 years</option>
          </select>
          <button
            onClick={handleRunBacktest}
            disabled={runningBacktest}
            className="btn-primary px-6"
          >
            {runningBacktest ? 'Running...' : 'Run Backtest'}
          </button>
        </div>

        {/* Backtest results */}
        {backtestResult && (
          <div className="space-y-4 animate-slide-up">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                label="Win Rate"
                value={backtestResult.win_rate_pct}
                sub={`${backtestResult.total_trades} trades`}
                color={backtestResult.win_rate >= 0.6 ? 'green' : 'red'}
              />
              <MetricCard
                label="Profit Factor"
                value={backtestResult.profit_factor?.toFixed(2)}
                color={backtestResult.profit_factor >= 1.5 ? 'green' : 'white'}
              />
              <MetricCard
                label="Max Drawdown"
                value={`${backtestResult.max_drawdown_pct?.toFixed(1)}%`}
                color="red"
              />
              <MetricCard
                label="Total Return"
                value={`${backtestResult.total_return_pct >= 0 ? '+' : ''}${backtestResult.total_return_pct?.toFixed(1)}%`}
                color={backtestResult.total_return_pct >= 0 ? 'green' : 'red'}
              />
            </div>

            {/* Accuracy by confidence */}
            {backtestResult.accuracy_by_confidence && (
              <div>
                <p className="text-sm font-semibold text-gray-400 mb-2">Win Rate by Confidence Level</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(backtestResult.accuracy_by_confidence).map(([bucket, rate]: any) => (
                    rate !== null && (
                      <div key={bucket} className="bg-dark-surface rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-500">{bucket}</p>
                        <p className={clsx('text-lg font-bold', rate >= 0.65 ? 'positive' : 'negative')}>
                          {(rate * 100).toFixed(0)}%
                        </p>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Equity curve */}
            {equityCurve.length > 1 && (
              <div>
                <p className="text-sm font-semibold text-gray-400 mb-2">Equity Curve (% of initial)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={equityCurve}>
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00C805" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#00C805" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                    <XAxis dataKey="trade" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, 'Portfolio']} />
                    <Area type="monotone" dataKey="equity" stroke="#00C805" fill="url(#eqGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Trade returns bar chart */}
            {tradeResults.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-400 mb-2">Individual Trade Returns</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={tradeResults}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, 'Return']} />
                    <Bar dataKey="return_pct" radius={[3, 3, 0, 0]}>
                      {tradeResults.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.win ? '#00C805' : '#FF5000'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <p className="text-xs text-gray-600">{backtestResult.summary}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function round2(n: number) { return Math.round(n * 100) / 100 }
