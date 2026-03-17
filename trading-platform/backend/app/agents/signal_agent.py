"""
Signal Agent
Cycles through ALL market symbols every 10 seconds, one at a time.
Runs 7-layer AI analysis → BUY/SELL/HOLD with confidence, targets, hold dates.
"""
import asyncio
from typing import Dict, List, Optional
from datetime import datetime, date, timedelta
from .base import BaseAgent
from app.services.live_feed import live_feed


# Full rotation — covers entire tracked universe (~100+ symbols over ~17 min)
FULL_ROTATION = [
    # US mega-cap tech
    "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "AMD",
    "NFLX", "ORCL", "CRM", "ADBE", "QCOM", "INTC", "TXN", "INTU", "NOW", "PANW", "PLTR",
    # US Finance
    "JPM", "V", "MA", "BAC", "GS", "MS", "WFC", "AXP", "SCHW", "BLK", "COIN", "SOFI",
    # US Healthcare
    "LLY", "UNH", "JNJ", "ABBV", "PFE", "MRK", "TMO", "AMGN",
    # US Consumer / Retail
    "WMT", "COST", "KO", "PEP", "MCD", "NKE", "SBUX", "TGT", "PG",
    # US Energy
    "XOM", "CVX", "COP", "OXY",
    # US Industrial
    "BA", "CAT", "HON", "GE", "LMT", "DE", "UPS", "FDX",
    # US Telecom/Media
    "DIS", "CMCSA", "VZ", "TMUS",
    # High-volatility
    "GME", "AMC", "RIVN", "LCID", "HOOD", "ARKK",
    # Crypto
    "BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD", "DOGE-USD", "ADA-USD", "AVAX-USD",
    # India
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
    "SBIN.NS", "WIPRO.NS", "TATAMOTORS.NS", "BAJFINANCE.NS",
    # ETFs
    "SPY", "QQQ", "IWM", "DIA", "XLF", "XLK",
]

MARKET_OF: Dict[str, str] = {}
for s in ["NVDA","AAPL","MSFT","GOOGL","AMZN","META","TSLA","AVGO","AMD","NFLX","ORCL",
          "CRM","ADBE","QCOM","INTC","TXN","INTU","NOW","PANW","PLTR","JPM","V","MA",
          "BAC","GS","MS","WFC","AXP","SCHW","BLK","COIN","SOFI","LLY","UNH","JNJ",
          "ABBV","PFE","MRK","TMO","AMGN","WMT","COST","KO","PEP","MCD","NKE","SBUX",
          "TGT","PG","XOM","CVX","COP","OXY","BA","CAT","HON","GE","LMT","DE","UPS",
          "FDX","DIS","CMCSA","VZ","TMUS","GME","AMC","RIVN","LCID","HOOD",
          "SPY","QQQ","IWM","DIA","XLF","XLK","ARKK"]:
    MARKET_OF[s] = "US"
for s in ["BTC-USD","ETH-USD","SOL-USD","BNB-USD","XRP-USD","DOGE-USD","ADA-USD","AVAX-USD"]:
    MARKET_OF[s] = "CRYPTO"
for s in ["RELIANCE.NS","TCS.NS","HDFCBANK.NS","INFY.NS","ICICIBANK.NS",
          "SBIN.NS","WIPRO.NS","TATAMOTORS.NS","BAJFINANCE.NS"]:
    MARKET_OF[s] = "INDIA"


def _hold_days(confidence: float, action: str) -> int:
    if action == "HOLD":
        return 0
    if confidence >= 0.80:
        return 3    # strong momentum — quick play
    elif confidence >= 0.65:
        return 7    # short swing
    elif confidence >= 0.52:
        return 14   # medium swing
    else:
        return 21   # weak — longer hold


class SignalAgent(BaseAgent):
    """Cycles through 100+ symbols, generating BUY/SELL/HOLD signals with entry/exit dates"""

    def __init__(self):
        super().__init__(name="signal_agent", interval_seconds=8.0)
        self.latest_signals: Dict[str, Dict] = {}
        self._symbol_queue: List[str] = []   # priority queue from scanner
        self._market_map: Dict[str, str] = {}
        self._rotation_idx: int = 0

    def queue_symbol(self, symbol: str, market: str):
        if symbol not in self._symbol_queue:
            self._symbol_queue.append(symbol)
            self._market_map[symbol] = market

    async def run(self):
        # Priority: scanner-flagged symbols first, then full rotation
        if self._symbol_queue:
            symbol = self._symbol_queue.pop(0)
            market = self._market_map.get(symbol, MARKET_OF.get(symbol, "US"))
        else:
            symbol = FULL_ROTATION[self._rotation_idx % len(FULL_ROTATION)]
            market = MARKET_OF.get(symbol, "US")
            self._rotation_idx += 1

        try:
            signal = await self._analyze(symbol, market)
            self.latest_signals[symbol] = signal
            action = signal["action"]
            await self._emit(
                "signal_generated",
                f"{symbol}: {action} @ ${signal['price']:.2f} | {signal['confidence']:.0%} conf | hold {signal.get('hold_days', 0)}d",
                symbol=symbol,
                data=signal,
                level="success" if action != "HOLD" else "info",
            )
        except Exception as e:
            await self._emit("signal_error", f"Analysis failed for {symbol}: {e}", level="error")

    async def _analyze(self, symbol: str, market: str) -> Dict:
        from app.services.market_data import fetch_history
        from app.services.news_service import fetch_symbol_news
        from app.ai.trading_agent import get_trading_agent

        quote = live_feed.get_quote(symbol)
        current_price = quote["price"] if quote else None

        df = await fetch_history(symbol, period="3mo", interval="1d")
        news = await fetch_symbol_news(symbol, limit=5)
        agent = get_trading_agent()

        today = date.today()

        if df is None or df.empty:
            return self._fallback_signal(symbol, market, current_price, quote)

        decision = agent.analyze(symbol, market, df, news)
        price = current_price or decision.current_price or 0
        hold = decision.hold_period_days
        entry_dt = today.isoformat()
        exit_dt  = (today + timedelta(days=hold)).isoformat() if hold else entry_dt

        return {
            "symbol":     symbol,
            "market":     market,
            "action":     decision.action,
            "confidence": decision.confidence,
            "price":      price,
            "target_price":       round(decision.target_price or price * 1.08, 2),
            "stop_loss":          round(decision.stop_loss or price * 0.95, 2),
            "risk_reward":        round(decision.risk_reward_ratio or 2.0, 2),
            "expected_return_pct": round(decision.expected_return_pct or 0, 2),
            "reasoning":   decision.reasoning,
            "position_size": decision.position_size,
            "hold_days":   hold,
            "entry_date":  entry_dt,
            "exit_date":   exit_dt,
            "timestamp":   datetime.utcnow().isoformat(),
            "source":      "ai_7layer",
        }

    def _fallback_signal(self, symbol: str, market: str,
                         price: Optional[float], quote: Optional[Dict]) -> Dict:
        change_pct = quote.get("change_pct", 0) if quote else 0
        score = change_pct / 4.0

        if score > 0.25:
            action, conf = "BUY",  min(0.78, 0.50 + abs(score))
        elif score < -0.25:
            action, conf = "SELL", min(0.78, 0.50 + abs(score))
        else:
            action, conf = "HOLD", 0.40

        p = price or 100.0
        hold = _hold_days(conf, action)
        today = date.today()
        return {
            "symbol":     symbol,
            "market":     market,
            "action":     action,
            "confidence": round(conf, 3),
            "price":      p,
            "target_price":  round(p * 1.05, 2) if action == "BUY" else round(p * 0.95, 2),
            "stop_loss":     round(p * 0.97, 2) if action == "BUY" else round(p * 1.03, 2),
            "risk_reward":   1.7,
            "expected_return_pct": round(abs(change_pct) * 1.5, 2),
            "reasoning":  f"Momentum signal: {change_pct:+.2f}% daily move",
            "position_size": 0.05,
            "hold_days":  hold,
            "entry_date": today.isoformat(),
            "exit_date":  (today + timedelta(days=hold)).isoformat() if hold else today.isoformat(),
            "timestamp":  datetime.utcnow().isoformat(),
            "source":     "momentum",
        }

    def get_signal(self, symbol: str) -> Optional[Dict]:
        return self.latest_signals.get(symbol)

    def get_all_signals(self) -> List[Dict]:
        return list(self.latest_signals.values())
