import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Quote } from '../types'

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
        localStorage.removeItem('auth_user')
        set({ user: null, token: null })
      },
    }),
    { name: 'auth-store' }
  )
)

interface MarketState {
  selectedMarket: 'US' | 'INDIA' | 'CRYPTO'
  setMarket: (m: 'US' | 'INDIA' | 'CRYPTO') => void
  liveQuotes: Record<string, Quote>
  updateQuotes: (quotes: Quote[]) => void
  watchlist: string[]
  addToWatchlist: (symbol: string) => void
  removeFromWatchlist: (symbol: string) => void
}

export const useMarketStore = create<MarketState>()(
  persist(
    (set, get) => ({
      selectedMarket: 'US',
      setMarket: (m) => set({ selectedMarket: m }),
      liveQuotes: {},
      updateQuotes: (quotes) => {
        const updated: Record<string, Quote> = { ...get().liveQuotes }
        for (const q of quotes) {
          updated[q.symbol] = q
        }
        set({ liveQuotes: updated })
      },
      watchlist: ['AAPL', 'NVDA', 'BTC-USD', 'RELIANCE.NS'],
      addToWatchlist: (symbol) =>
        set((s) => ({
          watchlist: s.watchlist.includes(symbol) ? s.watchlist : [...s.watchlist, symbol],
        })),
      removeFromWatchlist: (symbol) =>
        set((s) => ({ watchlist: s.watchlist.filter((w) => w !== symbol) })),
    }),
    { name: 'market-store' }
  )
)

interface UIState {
  sidebarOpen: boolean
  toggleSidebar: () => void
  theme: 'dark'
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  theme: 'dark',
}))
