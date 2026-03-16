import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Quote } from '../types'

// ── Auth ──────────────────────────────────────────────────────────────
interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem('auth_token', token)
        set({ user, token })
      },
      logout: () => {
        localStorage.removeItem('auth_token')
        set({ user: null, token: null })
      },
    }),
    { name: 'auth-store' }
  )
)

// ── Market ────────────────────────────────────────────────────────────
interface MarketState {
  selectedMarket: 'US' | 'INDIA' | 'CRYPTO'
  setMarket: (m: 'US' | 'INDIA' | 'CRYPTO') => void
  liveQuotes: Record<string, Quote>
  updateQuotes: (quotes: Quote[]) => void
  updateTickData: (ticks: Record<string, Quote>) => void
  selectedSymbol: string
  setSelectedSymbol: (s: string) => void
  watchlist: string[]
  addToWatchlist: (symbol: string) => void
  removeFromWatchlist: (symbol: string) => void
  priceHistory: Record<string, number[]>  // last 60 prices per symbol
  appendPrice: (symbol: string, price: number) => void
}

export const useMarketStore = create<MarketState>()(
  persist(
    (set, get) => ({
      selectedMarket: 'US',
      setMarket: (m) => set({ selectedMarket: m }),
      liveQuotes: {},
      selectedSymbol: 'NVDA',
      setSelectedSymbol: (s) => set({ selectedSymbol: s }),
      updateQuotes: (quotes) => {
        const updated: Record<string, Quote> = { ...get().liveQuotes }
        for (const q of quotes) updated[q.symbol] = q
        set({ liveQuotes: updated })
      },
      updateTickData: (ticks) => {
        const updated: Record<string, Quote> = { ...get().liveQuotes }
        for (const [sym, q] of Object.entries(ticks)) updated[sym] = q as Quote
        set({ liveQuotes: updated })
      },
      watchlist: ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'BTC-USD', 'ETH-USD'],
      addToWatchlist: (symbol) =>
        set((s) => ({
          watchlist: s.watchlist.includes(symbol) ? s.watchlist : [...s.watchlist, symbol],
        })),
      removeFromWatchlist: (symbol) =>
        set((s) => ({ watchlist: s.watchlist.filter((w) => w !== symbol) })),
      priceHistory: {},
      appendPrice: (symbol, price) =>
        set((s) => {
          const hist = [...(s.priceHistory[symbol] || []), price]
          if (hist.length > 60) hist.shift()
          return { priceHistory: { ...s.priceHistory, [symbol]: hist } }
        }),
    }),
    { name: 'market-store' }
  )
)

// ── Auto-Trader ───────────────────────────────────────────────────────
export interface AgentLogEntry {
  agent: string
  event: string
  detail: string
  symbol?: string
  level: string
  timestamp: string
  data?: Record<string, unknown>
}

export interface AgentTrade {
  symbol: string
  market: string
  action: string
  quantity: number
  price: number
  total_value: number
  confidence: number
  timestamp: string
}

export interface GoalProgress {
  deposit: number
  current_value: number
  target_value: number
  current_return_pct: number
  target_return_pct: number
  return_progress_pct: number
  time_progress_pct: number
  on_track: boolean
  strategy: string
  risk_multiplier: number
  days_remaining: number
  pnl: number
  pnl_pct: number
}

interface AutoTraderState {
  isActive: boolean
  config: {
    deposit: number
    target_return_pct: number
    days_to_goal: number
    risk_tolerance: string
  } | null
  agentLogs: AgentLogEntry[]
  agentTrades: AgentTrade[]
  goalProgress: GoalProgress | null
  opportunities: Record<string, unknown>[]
  setActive: (active: boolean) => void
  setConfig: (config: AutoTraderState['config']) => void
  addLog: (log: AgentLogEntry) => void
  addTrade: (trade: AgentTrade) => void
  setGoalProgress: (progress: GoalProgress) => void
  setOpportunities: (opps: Record<string, unknown>[]) => void
}

export const useAutoTraderStore = create<AutoTraderState>((set) => ({
  isActive: false,
  config: null,
  agentLogs: [],
  agentTrades: [],
  goalProgress: null,
  opportunities: [],
  setActive: (active) => set({ isActive: active }),
  setConfig: (config) => set({ config }),
  addLog: (log) =>
    set((s) => ({
      agentLogs: [...s.agentLogs.slice(-199), log],
    })),
  addTrade: (trade) =>
    set((s) => ({
      agentTrades: [trade, ...s.agentTrades.slice(0, 99)],
    })),
  setGoalProgress: (progress) => set({ goalProgress: progress }),
  setOpportunities: (opps) => set({ opportunities: opps }),
}))

// ── UI ────────────────────────────────────────────────────────────────
interface UIState {
  sidebarOpen: boolean
  toggleSidebar: () => void
  theme: 'dark'
  activeTab: string
  setActiveTab: (t: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  theme: 'dark',
  activeTab: 'chart',
  setActiveTab: (t) => set({ activeTab: t }),
}))
