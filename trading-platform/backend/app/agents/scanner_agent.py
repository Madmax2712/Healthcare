"""
Market Scanner Agent
Scans 100+ symbols every 5 seconds for technical breakout / opportunity signals.
Tier-1 symbols (live_feed): real-time 1s prices.
Tier-2 symbols (yfinance batch): refreshed every 60s for daily change_pct.
Flags the strongest movers for deep SignalAgent analysis.
"""
import asyncio
import logging
from typing import Dict, List, Set
from datetime import datetime
from .base import BaseAgent
from app.services.live_feed import live_feed

logger = logging.getLogger(__name__)

# Tier-1: live-feed symbols (real-time)
TIER1_SYMBOLS = {
    "US": ["AAPL", "MSFT", "NVDA", "TSLA", "META", "GOOGL", "AMZN", "JPM",
           "AMD", "NFLX", "V", "MA", "PLTR", "COIN", "HOOD"],
    "INDIA": ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
              "SBIN.NS", "WIPRO.NS", "HCLTECH.NS", "TATAMOTORS.NS", "BAJFINANCE.NS"],
    "CRYPTO": ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD",
               "DOGE-USD", "ADA-USD", "AVAX-USD"],
}

# Tier-2: extended US stocks scanned via yfinance batch every 60s
TIER2_US = [
    "LLY", "UNH", "ABBV", "JNJ", "PFE", "MRK", "TMO", "ABT", "AMGN", "DHR",
    "XOM", "CVX", "COP", "OXY", "SLB",
    "BAC", "GS", "MS", "WFC", "C", "AXP", "BLK", "SCHW",
    "WMT", "COST", "KO", "PEP", "MCD", "NKE", "SBUX", "TGT", "PG",
    "BA", "CAT", "HON", "RTX", "LMT", "GE", "DE", "UPS", "FDX",
    "DIS", "CMCSA", "VZ", "T", "TMUS",
    "AVGO", "ORCL", "CRM", "ADBE", "QCOM", "TXN", "INTU", "NOW", "PANW", "SNOW",
    "NEE", "AMT", "PLD", "BRK-B",
    "GME", "AMC", "RIVN", "LCID", "SOFI",
    "SPY", "QQQ", "IWM", "ARKK", "DIA", "XLF", "XLK",
]

ALL_TIER1 = [s for syms in TIER1_SYMBOLS.values() for s in syms]
MARKET_MAP: Dict[str, str] = {}
for mkt, syms in TIER1_SYMBOLS.items():
    for s in syms:
        MARKET_MAP[s] = mkt
for s in TIER2_US:
    MARKET_MAP[s] = "US"


class MarketScannerAgent(BaseAgent):
    """Scans 100+ market symbols for momentum/breakout signals every 5 seconds"""

    def __init__(self):
        super().__init__(name="market_scanner", interval_seconds=5.0)
        self._price_history: Dict[str, List[float]] = {}
        self._tier2_quotes: Dict[str, Dict] = {}   # cached yfinance batch
        self._last_tier2_fetch: float = 0.0
        self.opportunities: List[Dict] = []

    async def run(self):
        now = asyncio.get_event_loop().time()

        # Refresh tier-2 quotes every 60s
        if now - self._last_tier2_fetch > 60:
            asyncio.create_task(self._refresh_tier2())
            self._last_tier2_fetch = now

        all_quotes: Dict[str, Dict] = {}

        # Tier-1: from live_feed (real-time)
        for sym in ALL_TIER1:
            q = live_feed.get_quote(sym)
            if q:
                all_quotes[sym] = {**q, "market": MARKET_MAP.get(sym, "US")}

        # Tier-2: from cached yfinance batch
        for sym, q in self._tier2_quotes.items():
            if sym not in all_quotes:
                all_quotes[sym] = q

        new_opportunities = []
        for symbol, quote in all_quotes.items():
            price = quote.get("price", 0)
            if not price:
                continue

            # Track rolling history
            hist = self._price_history.setdefault(symbol, [])
            hist.append(price)
            if len(hist) > 12:
                hist.pop(0)

            change_pct = quote.get("change_pct", 0) or 0

            signal_strength = 0.0
            signals = []

            # Momentum over last 12 ticks
            if len(hist) >= 6:
                momentum_1m = (hist[-1] - hist[0]) / hist[0] * 100 if hist[0] > 0 else 0
                if abs(momentum_1m) > 0.15:
                    signal_strength += abs(momentum_1m) * 2
                    signals.append(f"{'↑' if momentum_1m > 0 else '↓'} {abs(momentum_1m):.2f}% 1m momentum")

            # Daily move — always available
            if abs(change_pct) > 1.0:
                signal_strength += abs(change_pct) * 0.8
                signals.append(f"{'▲' if change_pct > 0 else '▼'} {change_pct:+.2f}% today")

            if abs(change_pct) > 3.0:
                signal_strength += abs(change_pct)   # extra boost for big movers
                signals.append("Strong daily mover")

            # Determine action from change_pct and momentum
            direction = "BULLISH" if change_pct >= 0 else "BEARISH"
            action = "BUY" if change_pct > 0.5 else ("SELL" if change_pct < -0.5 else "HOLD")
            confidence = min(0.90, 0.45 + abs(change_pct) * 0.04 + signal_strength * 0.02)

            if signal_strength > 0.5 or abs(change_pct) > 1.0:
                new_opportunities.append({
                    "symbol": symbol,
                    "market": MARKET_MAP.get(symbol, "US"),
                    "name": quote.get("name", symbol),
                    "price": price,
                    "change_pct": change_pct,
                    "signal_strength": round(signal_strength, 2),
                    "direction": direction,
                    "action": action,
                    "confidence": round(confidence, 3),
                    "signals": signals,
                    "timestamp": datetime.utcnow().isoformat(),
                })

        new_opportunities.sort(key=lambda x: abs(x["change_pct"]), reverse=True)
        self.opportunities = new_opportunities[:30]  # keep top 30

        total = len(all_quotes)
        movers = len(new_opportunities)
        if new_opportunities:
            top = new_opportunities[0]
            await self._emit(
                "scan_complete",
                f"Scanned {total} symbols — {movers} movers. Top: {top['symbol']} {top['change_pct']:+.2f}%",
                symbol=top["symbol"],
                data={"count": movers, "top": top},
            )
        else:
            await self._emit("scan_complete", f"Scanned {total} symbols — market quiet")

    async def _refresh_tier2(self):
        """Batch-fetch daily change_pct for tier-2 symbols via yfinance"""
        try:
            import yfinance as yf
            loop = asyncio.get_event_loop()

            def _fetch():
                result = {}
                tickers = yf.Tickers(" ".join(TIER2_US))
                for sym in TIER2_US:
                    try:
                        t = tickers.tickers.get(sym)
                        if t is None:
                            continue
                        fi = t.fast_info
                        price = getattr(fi, "last_price", None) or getattr(fi, "regular_market_price", None)
                        prev  = getattr(fi, "previous_close", None) or getattr(fi, "regular_market_previous_close", None)
                        if price and prev and prev > 0:
                            result[sym] = {
                                "price": float(price),
                                "change_pct": round((price - prev) / prev * 100, 2),
                                "market": "US",
                                "name": sym,
                                "source": "yfinance_batch",
                            }
                    except Exception:
                        continue
                return result

            quotes = await loop.run_in_executor(None, _fetch)
            self._tier2_quotes = quotes
            logger.info(f"Scanner tier-2 refresh: {len(quotes)} symbols")
        except Exception as e:
            logger.warning(f"Tier-2 batch fetch failed: {e}")

    def get_top_opportunities(self, n: int = 10) -> List[Dict]:
        return self.opportunities[:n]
