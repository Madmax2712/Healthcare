"""
Market Scanner Agent
Scans all symbols every 5 seconds for technical breakout / opportunity signals.
Flags symbols with strong momentum for deep analysis by SignalAgent.
"""
import asyncio
from typing import Dict, List, Optional, Set
from .base import BaseAgent
from app.services.live_feed import live_feed


SCAN_SYMBOLS = {
    "US": ["AAPL", "MSFT", "NVDA", "TSLA", "META", "GOOGL", "AMZN", "JPM"],
    "INDIA": ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS"],
    "CRYPTO": ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD"],
}

ALL_SCAN_SYMBOLS = [s for syms in SCAN_SYMBOLS.values() for s in syms]


class MarketScannerAgent(BaseAgent):
    """Scans market for high-potential opportunities using price momentum & volume surge"""

    def __init__(self):
        super().__init__(name="market_scanner", interval_seconds=5.0)
        self._price_history: Dict[str, List[float]] = {s: [] for s in ALL_SCAN_SYMBOLS}
        self._volume_history: Dict[str, List[int]] = {s: [] for s in ALL_SCAN_SYMBOLS}
        self.opportunities: List[Dict] = []
        self._flagged: Set[str] = set()

    async def run(self):
        quotes = {}
        for symbol in ALL_SCAN_SYMBOLS:
            q = live_feed.get_quote(symbol)
            if q:
                quotes[symbol] = q

        new_opportunities = []
        for symbol, quote in quotes.items():
            price = quote["price"]
            volume = quote.get("volume", 0)

            # Track rolling history (last 12 ticks = ~1 minute)
            hist = self._price_history[symbol]
            hist.append(price)
            if len(hist) > 12:
                hist.pop(0)

            vol_hist = self._volume_history[symbol]
            vol_hist.append(volume)
            if len(vol_hist) > 12:
                vol_hist.pop(0)

            if len(hist) < 6:
                continue

            # Signal: momentum breakout
            momentum_1m = (hist[-1] - hist[0]) / hist[0] * 100 if hist[0] > 0 else 0
            price_acc = (hist[-1] - hist[-3]) / hist[-3] * 100 if len(hist) >= 3 and hist[-3] > 0 else 0

            signal_strength = 0
            signals = []

            if abs(momentum_1m) > 0.25:
                signal_strength += abs(momentum_1m) * 2
                signals.append(f"{'↑' if momentum_1m > 0 else '↓'} {abs(momentum_1m):.2f}% momentum")

            if abs(price_acc) > 0.15:
                signal_strength += abs(price_acc) * 3
                signals.append(f"{'Acceleration ↑' if price_acc > 0 else 'Deceleration ↓'}")

            change_pct = quote.get("change_pct", 0)
            if abs(change_pct) > 1.5:
                signal_strength += abs(change_pct)
                signals.append(f"{'Strong day gain' if change_pct > 0 else 'Sharp selloff'} {change_pct:.2f}%")

            if signal_strength > 1.0:
                direction = "BULLISH" if momentum_1m > 0 else "BEARISH"
                opp = {
                    "symbol": symbol,
                    "market": quote["market"],
                    "name": quote["name"],
                    "price": price,
                    "change_pct": change_pct,
                    "signal_strength": round(signal_strength, 2),
                    "direction": direction,
                    "signals": signals,
                    "momentum_1m": round(momentum_1m, 4),
                }
                new_opportunities.append(opp)

        # Sort by signal strength
        new_opportunities.sort(key=lambda x: x["signal_strength"], reverse=True)
        self.opportunities = new_opportunities[:8]

        if new_opportunities:
            top = new_opportunities[0]
            await self._emit(
                "scan_complete",
                f"Found {len(new_opportunities)} opportunities. Top: {top['symbol']} ({top['direction']}, strength={top['signal_strength']})",
                symbol=top["symbol"],
                data={"opportunities": new_opportunities[:3]},
            )
        else:
            await self._emit("scan_complete", f"Scanned {len(ALL_SCAN_SYMBOLS)} symbols — no strong signals")

    def get_top_opportunities(self, n: int = 5) -> List[Dict]:
        return self.opportunities[:n]
