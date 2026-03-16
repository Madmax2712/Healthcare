import { useRef, useEffect } from 'react'
import { Bot, AlertCircle, CheckCircle, Info, Zap } from 'lucide-react'
import { useAutoTraderStore } from '../store'

const AGENT_COLORS: Record<string, string> = {
  market_scanner: 'text-purple-400',
  signal_agent: 'text-blue-400',
  risk_agent: 'text-yellow-400',
  trade_executor: 'text-green-400',
  position_monitor: 'text-orange-400',
  goal_agent: 'text-pink-400',
}

const LEVEL_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />,
  warning: <AlertCircle className="w-3 h-3 text-yellow-400 flex-shrink-0" />,
  error: <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />,
  info: <Info className="w-3 h-3 text-blue-400 flex-shrink-0" />,
}

export default function AgentLogFeed({ maxHeight = 320 }: { maxHeight?: number }) {
  const logs = useAutoTraderStore((s) => s.agentLogs)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-600 text-xs">
        <Bot className="w-4 h-4 mr-2" />
        Agent logs will appear here when auto-trading is active
      </div>
    )
  }

  return (
    <div
      className="overflow-y-auto font-mono text-xs space-y-0.5"
      style={{ maxHeight }}
    >
      {logs.map((log, i) => (
        <div
          key={i}
          className="flex items-start gap-2 px-2 py-0.5 hover:bg-[#161b22] rounded group"
        >
          {LEVEL_ICONS[log.level] ?? <Info className="w-3 h-3 text-gray-500 flex-shrink-0" />}
          <span className="text-gray-600 flex-shrink-0">
            {new Date(log.timestamp).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className={`flex-shrink-0 font-semibold ${AGENT_COLORS[log.agent] ?? 'text-gray-400'}`}>
            [{log.agent.replace('_', '-')}]
          </span>
          {log.symbol && (
            <span className="text-white flex-shrink-0">{log.symbol}</span>
          )}
          <span className="text-gray-400 truncate">{log.detail}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
