# FinanceAI Trading Platform

> **AI-powered trading platform for US stocks, India (NSE/BSE), and Crypto markets**
> Robinhood-like UI · Live market data · News sentiment · Paper trading

---

## Features

### AI Trading Engine
- **Multi-signal fusion**: Combines news sentiment (30%), technical analysis (40%), and price prediction (30%)
- **Sentiment analysis**: Real-time NLP analysis of global financial news using VADER + financial lexicon
- **Technical analysis**: RSI, MACD, Bollinger Bands, EMA crossovers, volume signals
- **Price prediction**: Statistical trend analysis with momentum and mean-reversion
- **Risk management**: Kelly-inspired position sizing, stop-loss, take-profit, R:R ratio filtering (minimum 1.5:1)
- **Confidence scoring**: Only trades when all signals agree and confidence ≥ 65%

### Markets Covered
| Market | Coverage |
|--------|----------|
| 🇺🇸 US Stocks | AAPL, MSFT, NVDA, TSLA, GOOGL, AMZN, META, JPM, V, + indices (SPY, QQQ) |
| 🇮🇳 India | RELIANCE, TCS, HDFC Bank, Infosys, Wipro, SBI + NIFTY 50, SENSEX |
| ₿ Crypto | BTC, ETH, BNB, SOL, XRP, ADA, AVAX, DOGE, DOT, MATIC |

### Platform Features
- **Live price ticker** — real-time WebSocket price updates
- **Interactive charts** — 1D to 1Y with multiple intervals
- **AI signal dashboard** — BUY/SELL/HOLD with full reasoning
- **News sentiment feed** — 50+ articles with sentiment scoring
- **Paper trading** — $100,000 virtual balance, full portfolio management
- **Trade history** — track AI vs manual trades

---

## Tech Stack

### Backend
- **FastAPI** — async API framework
- **SQLAlchemy** — async ORM with SQLite
- **yfinance** — real-time market data
- **VADER + financial lexicon** — sentiment analysis
- **APScheduler** — background price feed
- **WebSockets** — live price streaming

### Frontend
- **React 18 + TypeScript** — UI framework
- **TailwindCSS** — styling (dark theme)
- **Recharts** — interactive charts
- **React Query** — data fetching & caching
- **Zustand** — state management
- **Framer Motion** — animations

---

## Quick Start

### Option 1: Docker (Recommended)
```bash
cd trading-platform
cp backend/.env.example backend/.env
# Add your API keys to backend/.env (optional, works without them)
docker-compose up --build
```
Open: http://localhost:3000

### Option 2: Manual Setup

**Backend:**
```bash
cd trading-platform/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/api/docs

**Frontend:**
```bash
cd trading-platform/frontend
npm install
npm run dev
```
Open: http://localhost:5173

---

## Configuration

Edit `backend/.env`:

```env
# Optional API keys for better data
NEWS_API_KEY=your_newsapi_org_key       # Get free at newsapi.org
ALPHA_VANTAGE_KEY=your_alpha_vantage_key

# Trading parameters (paper trading only)
INITIAL_BALANCE=100000.0     # Starting virtual balance
MAX_POSITION_SIZE=0.10       # Max 10% of portfolio per trade
STOP_LOSS_PCT=0.05           # 5% stop loss
TAKE_PROFIT_PCT=0.15         # 15% take profit
MAX_DAILY_LOSS_PCT=0.02      # 2% max daily loss

# AI weights (must sum to 1.0)
SENTIMENT_WEIGHT=0.30
TECHNICAL_WEIGHT=0.40
PREDICTION_WEIGHT=0.30
MIN_CONFIDENCE_THRESHOLD=0.65  # Only trade at 65%+ confidence
```

---

## API Reference

| Endpoint | Description |
|----------|-------------|
| `GET /api/market/overview` | Major indices for all markets |
| `GET /api/market/quote/{symbol}` | Real-time quote |
| `GET /api/market/history/{symbol}` | Historical OHLCV data |
| `GET /api/predictions/signal/{symbol}` | AI trading signal |
| `GET /api/predictions/top-opportunities` | Top AI opportunities |
| `GET /api/predictions/market-sentiment` | Global sentiment |
| `GET /api/news/global` | Global news with sentiment |
| `POST /api/trading/execute` | Execute manual trade |
| `POST /api/trading/ai-trade` | Let AI execute trade |
| `GET /api/trading/portfolio` | Portfolio summary |
| `WS /ws` | Live price WebSocket |

---

## ⚠️ Important Disclaimer

> **This platform operates in paper trading mode only** (no real money).
>
> No trading algorithm can guarantee profits. Markets are inherently uncertain.
> This platform is for educational and research purposes.
>
> - Past AI signal accuracy does not guarantee future results
> - Always consult a licensed financial advisor for real investments
> - Crypto and stock markets involve substantial risk of loss
>
> **Never invest money you cannot afford to lose.**

---

## Roadmap

- [ ] Connect to real brokers (Alpaca for US, Zerodha for India, Binance for Crypto)
- [ ] Advanced ML model (Transformer/LSTM trained on historical data)
- [ ] Options & derivatives signals
- [ ] Multi-user with social features
- [ ] Mobile app (React Native)
- [ ] Backtesting engine
- [ ] Email/SMS trade alerts

---

## License

MIT — Use for educational purposes. Not financial advice.
