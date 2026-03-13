export interface Quote {
  symbol: string
  name: string
  market: 'US' | 'INDIA' | 'CRYPTO'
  sector: string
  price: number
  change: number
  change_pct: number
  volume: number
  market_cap: number
  pe_ratio?: number
  high_52w?: number
  low_52w?: number
  avg_volume?: number
  currency: string
  timestamp: string
}

export interface CandleData {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface AISignal {
  symbol: string
  market: string
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  reasoning: string
  current_price: number
  predicted_price: number
  target_price: number
  stop_loss: number
  expected_return_pct: number
  risk_reward_ratio: number
  position_size: number
  sentiment_score: number
  technical_score: number
  signals: {
    sentiment: {
      score: number
      label: string
      confidence: number
      count: number
      bullish_count: number
      bearish_count: number
    }
    technical: {
      action: string
      rsi: number
      macd: string
      bb: string
      ema: string
      volume: string
      indicators: Record<string, number>
      support: number
      resistance: number
    }
    prediction: {
      direction: string
      predicted_price: number
      change_pct: number
      confidence: number
    }
    final_score: number
  }
  timestamp: string
}

export interface NewsArticle {
  title: string
  description: string
  url: string
  source: { name: string }
  publishedAt: string
  sentiment_score: number
  sentiment_label: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  sentiment_confidence: number
}

export interface Position {
  symbol: string
  market: string
  quantity: number
  avg_cost: number
  current_price: number
  market_value: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
}

export interface Portfolio {
  cash_balance: number
  invested_value: number
  total_value: number
  total_pnl: number
  total_pnl_pct: number
  positions: Position[]
  positions_count: number
}

export interface Trade {
  id: number
  symbol: string
  market: string
  action: 'BUY' | 'SELL'
  quantity: number
  price: number
  total_value: number
  status: string
  is_ai_trade: boolean
  ai_confidence: number
  timestamp: string
}

export interface MarketSentiment {
  score: number
  label: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  confidence: number
  count: number
  bullish_count: number
  bearish_count: number
  neutral_count: number
  total_articles: number
  timestamp: string
  top_headlines: {
    title: string
    sentiment: string
    score: number
    source: string
  }[]
}

export interface User {
  id: number
  email: string
  username: string
  is_active: boolean
}

export interface AuthToken {
  access_token: string
  token_type: string
  user: User
}

export type MarketType = 'US' | 'INDIA' | 'CRYPTO'
export type TimeRange = '1d' | '1w' | '1mo' | '3mo' | '6mo' | '1y'
