import axios from 'axios'

const BASE_URL = '/api'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
})

// Auth token injection
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Market
export const marketApi = {
  overview: () => api.get('/market/overview').then(r => r.data),
  symbols: () => api.get('/market/symbols').then(r => r.data),
  symbolsByMarket: (market: string) => api.get(`/market/symbols/${market}`).then(r => r.data),
  quote: (symbol: string) => api.get(`/market/quote/${symbol}`).then(r => r.data),
  quotes: (symbols: string[]) => api.get(`/market/quotes?symbols=${symbols.join(',')}`).then(r => r.data),
  history: (symbol: string, period = '3mo', interval = '1d') =>
    api.get(`/market/history/${symbol}?period=${period}&interval=${interval}`).then(r => r.data),
  screener: (market: string) => api.get(`/market/screener?market=${market}`).then(r => r.data),
}

// Predictions / AI
export const aiApi = {
  signal: (symbol: string, market: string) =>
    api.get(`/predictions/signal/${symbol}?market=${market}`).then(r => r.data),
  bulkSignals: (market: string, limit = 10) =>
    api.get(`/predictions/bulk-signals?market=${market}&limit=${limit}`).then(r => r.data),
  marketSentiment: () => api.get('/predictions/market-sentiment').then(r => r.data),
  technical: (symbol: string) => api.get(`/predictions/technical/${symbol}`).then(r => r.data),
  topOpportunities: () => api.get('/predictions/top-opportunities').then(r => r.data),
}

// News
export const newsApi = {
  global: (limit = 30) => api.get(`/news/global?limit=${limit}`).then(r => r.data),
  symbol: (symbol: string, limit = 10) => api.get(`/news/symbol/${symbol}?limit=${limit}`).then(r => r.data),
  sentiment: () => api.get('/news/sentiment').then(r => r.data),
}

// Trading
export const tradingApi = {
  portfolio: () => api.get('/trading/portfolio').then(r => r.data),
  history: (limit = 50) => api.get(`/trading/history?limit=${limit}`).then(r => r.data),
  executeTrade: (data: {
    symbol: string; market: string; action: string; quantity: number; price?: number
  }) => api.post('/trading/execute', data).then(r => r.data),
  aiTrade: (symbol: string, market: string) =>
    api.post('/trading/ai-trade', { symbol, market }).then(r => r.data),
  refreshPrices: () => api.post('/trading/refresh-prices').then(r => r.data),
}

// Auth
export const authApi = {
  login: (username: string, password: string) => {
    const form = new FormData()
    form.append('username', username)
    form.append('password', password)
    return api.post('/auth/login', form).then(r => r.data)
  },
  register: (email: string, username: string, password: string) =>
    api.post('/auth/register', { email, username, password }).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
}
