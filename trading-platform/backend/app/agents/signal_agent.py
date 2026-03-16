"""
Signal Agent
Runs the full 7-layer AI analysis on symbols flagged by the scanner.
Generates BUY/SELL/HOLD decisions with confidence scores.
"""
import asyncio
from typing import Dict, List, Optional
from datetime import datetime
from .base import BaseAgent
from app.services.live_feed import live_feed


class SignalAgent(BaseAgent):
    """Runs full AI analysis and generates trading signals"""

    def __init__(self):
        super().__init__(name="signal_agent", interval_seconds=10.0)
        self.latest_signals: Dict[str, Dict] = {}
        self._symbol_queue: List[str] = []
        self._market_map: Dict[str, str] = {}

    def queue_symbol(self, symbol: str, market: str):
        """Queue a symbol for analysis (called by scanner or orchestrator)"""
        if symbol not in self._symbol_queue:
            self._symbol_queue.append(symbol)
            self._market_map[symbol] = market

    async def run(self):
        if not self._symbol_queue:
            # Default: analyze a rotation of key symbols
            rotation = ["NVDA", "AAPL", "MSFT", "BTC-USD", "ETH-USD"]
            markets = {"NVDA": "US", "AAPL": "US", "MSFT": "US", "BTC-USD": "CRYPTO", "ETH-USD": "CRYPTO"}
            idx = self.run_count % len(rotation)
            symbol = rotation[idx]
            market = markets[symbol]
        else:
            symbol = self._symbol_queue.pop(0)
            market = self._market_map.get(symbol, "US")

        try:
            signal = await self._analyze(symbol, market)
            self.latest_signals[symbol] = signal

            await self._emit(
                "signal_generated",
                f"{symbol}: {signal['action']} @ ${signal['price']:.2f} | Conf: {signal['confidence']:.0%}",
                symbol=symbol,
                data=signal,
                level="info" if signal["action"] == "HOLD" else "success",
            )
        except Exception as e:
            await self._emit("signal_error", f"Failed to analyze {symbol}: {e}", symbol=symbol, level="error")

    async def _analyze(self, symbol: str, market: str) -> Dict:
        """Generate a trading signal using technical + momentum analysis on live prices"""
        from app.services.market_data import fetch_history
        from app.services.news_service import fetch_symbol_news
        from app.ai.trading_agent import get_trading_agent

        # Get live price
        quote = live_feed.get_quote(symbol)
        current_price = quote["price"] if quote else None

        df = await fetch_history(symbol, period="3mo", interval="1d")
        news = await fetch_symbol_news(symbol, limit=10)

        agent = get_trading_agent()

        if df is None or df.empty:
            return self._fallback_signal(symbol, market, current_price, quote)

        decision = agent.analyze(symbol, market, df, news)

        # Patch with live price
        price = current_price or decision.current_price or 0
        target = price * 1.08 if decision.action == "BUY" else price * 0.92
        stop = price * 0.95 if decision.action == "BUY" else price * 1.05

        return {
            "symbol": symbol,
            "market": market,
            "action": decision.action,
            "confidence": decision.confidence,
            "price": price,
            "target_price": round(getattr(decision, "target_price", None) or target, 2),
            "stop_loss": round(getattr(decision, "stop_loss", None) or stop, 2),
            "risk_reward": round(getattr(decision, "risk_reward_ratio", 0) or 2.5, 2),
            "reasoning": decision.reasoning,
            "position_size": decision.position_size,
            "timestamp": datetime.utcnow().isoformat(),
            "source": "ai_7layer",
        }

    def _fallback_signal(self, symbol: str, market: str, price: Optional[float], quote: Optional[Dict]) -> Dict:
        """Momentum-only signal when historical data is unavailable"""
        import random
        change_pct = quote.get("change_pct", 0) if quote else 0
        momentum_score = change_pct / 5.0  # normalize

        if momentum_score > 0.3:
            action, conf = "BUY", min(0.75, 0.55 + momentum_score)
        elif momentum_score < -0.3:
            action, conf = "SELL", min(0.75, 0.55 + abs(momentum_score))
        else:
            action, conf = "HOLD", 0.45

        p = price or 100.0
        return {
            "symbol": symbol,
            "market": market,
            "action": action,
            "confidence": round(conf, 3),
            "price": p,
            "target_price": round(p * 1.06, 2) if action == "BUY" else round(p * 0.94, 2),
            "stop_loss": round(p * 0.96, 2) if action == "BUY" else round(p * 1.04, 2),
            "risk_reward": 2.0,
            "reasoning": f"Momentum-based signal: {change_pct:.2f}% daily change",
            "position_size": 0.05,
            "timestamp": datetime.utcnow().isoformat(),
            "source": "momentum_fallback",
        }

    def get_signal(self, symbol: str) -> Optional[Dict]:
        return self.latest_signals.get(symbol)

    def get_all_signals(self) -> List[Dict]:
        return list(self.latest_signals.values())
