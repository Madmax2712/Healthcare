import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { clsx } from 'clsx'
import type { Portfolio } from '../types'

const COLORS = ['#00C805', '#1DB0F5', '#7B61FF', '#F5A623', '#FF5000', '#00D2FF', '#6EE7B7']

interface Props {
  portfolio: Portfolio
}

export default function PortfolioChart({ portfolio }: Props) {
  const positions = portfolio.positions || []

  // Pie chart data
  const pieData = [
    ...positions.map((p, i) => ({
      name: p.symbol,
      value: p.market_value,
      color: COLORS[i % COLORS.length],
    })),
    {
      name: 'Cash',
      value: portfolio.cash_balance,
      color: '#4B5563',
    },
  ].filter(d => d.value > 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    const pct = ((d.value / portfolio.total_value) * 100).toFixed(1)
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-3 text-xs">
        <p className="font-semibold mb-1">{d.name}</p>
        <p>${d.value.toFixed(2)} ({pct}%)</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={entry.name} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="space-y-1.5">
        {pieData.map((d) => {
          const pct = ((d.value / portfolio.total_value) * 100).toFixed(1)
          return (
            <div key={d.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-gray-300">{d.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500">{pct}%</span>
                <span className="font-mono text-gray-200">${d.value.toFixed(0)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
