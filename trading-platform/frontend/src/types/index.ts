export interface Quote {
  symbol: string
  name: string
  market: 'US' | 'INDIA' | 'CRYPTO' | string
  sector: string
  price: number
  open?: number
  high?: number
  low?: number
  change: number
  change_pct: number
  volume: number
  market_cap?: number
  pe_ratio?: number
  high_52w?: number
  low_52w?: number
  avg_volume?: number
  prev_close?: number
  currency?: string
  timestamp: string
  tick?: number
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
  prediction_score?: number
  ensemble_agreement?: number
  regime?: string
  layers_passed?: number
  layers_total?: number
  is_high_confidence?: boolean
  why_filtered?: string[]
  signals: {
    sentiment: {
      score: number
      label: string
      confidence: number
      count?: number
      bullish_count?: number
      bearish_count?: number
      passed?: boolean
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
      passed?: boolean
    }
    prediction: {
      direction: string
      predicted_price: number
      change_pct: number
      confidence: number
      passed?: boolean
    }
    ensemble?: {
      action: string
      agreement: number
      buy_votes: number
      sell_votes: number
      hold_votes: number
      is_high_confidence: boolean
      passed?: boolean
    }
    regime?: {
      type: string
      strength: number
      signal_filter: string
      description: string
      passed?: boolean
    }
    layers_passed?: number
    layers_total?: number
    fused_score?: number
    why_filtered?: string[]
    final_score?: number
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
