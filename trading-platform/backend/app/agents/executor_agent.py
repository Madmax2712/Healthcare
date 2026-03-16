"""
Trade Executor Agent
Executes approved trades with smart order logic:
  - Market orders with slippage modeling
  - Records AI reasoning and agent decisions
  - Broadcasts trade events to WebSocket clients
"""
import asyncio
from typing import Dict, Optional, List
from datetime import datetime
from .base import BaseAgent
from app.services.live_feed import live_feed


class TradeExecutorAgent(BaseAgent):
    """Executes trades approved by risk agent"""

    def __init__(self):
        super().__init__(name="trade_executor", interval_seconds=30.0)
        self._pending_trades: List[Dict] = []
        self._execution_history: List[Dict] = []
        self.total_trades = 0
        self.total_pnl = 0.0

    async def run(self):
        """Process any pending trades in queue"""
        if self._pending_trades:
            trade = self._pending_trades.pop(0)
            await self._execute(trade)
        else:
            pass  # idle

    def queue_trade(self, trade: Dict):
        """Add a trade to the execution queue"""
        self._pending_trades.append(trade)

    async def execute_now(
        self,
        user_id: int,
        symbol: str,
        market: str,
        action: str,
        position_size_pct: float,
        signal: Dict,
        db,
    ) -> Dict:
        """Execute a trade immediately (called by orchestrator)"""
        from app.services.market_data import fetch_quote
        from app.services.trading_service import execute_trade, get_or_create_portfolio, InsufficientFundsError, InvalidTradeError

        # Get live price (with simulated slippage)
        live_price = live_feed.get_latest_price(symbol)
        if not live_price:
            q = await fetch_quote(symbol)
            live_price = q["price"] if q else None

        if not live_price:
            raise ValueError(f"Cannot get price for {symbol}")

        # Slippage: 0.01-0.05% for stocks, 0.05-0.15% for crypto
        slippage_bps = 1 if market != "CRYPTO" else 5
        slippage = live_price * slippage_bps / 10000
        execution_price = live_price + (slippage if action == "BUY" else -slippage)

        # Calculate position size
        portfolio = await get_or_create_portfolio(user_id, db)
        dollars = portfolio.total_value * position_size_pct
        quantity = dollars / execution_price if execution_price > 0 else 0

        is_crypto = market == "CRYPTO"
        quantity = round(quantity, 6) if is_crypto else round(quantity, 2)

        if quantity < 0.001:
            raise ValueError("Quantity too small to trade")

        reasoning = signal.get("reasoning", f"Auto-trade: {signal.get('action')} signal")
        confidence = signal.get("confidence", 0)

        result = await execute_trade(
            user_id=user_id,
            symbol=symbol,
            market=market,
            action=action,
            quantity=quantity,
            price=execution_price,
            db=db,
            is_ai_trade=True,
            ai_confidence=confidence,
            ai_reasoning=f"[AGENT] {reasoning}",
        )

        trade_record = {
            "symbol": symbol,
            "market": market,
            "action": action,
            "quantity": quantity,
            "price": round(execution_price, 4),
            "total_value": round(quantity * execution_price, 2),
            "confidence": confidence,
            "signal": signal,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self._execution_history.append(trade_record)
        if len(self._execution_history) > 500:
            self._execution_history = self._execution_history[-500:]

        self.total_trades += 1

        await self._emit(
            "trade_executed",
            f"{action} {quantity:.4f} {symbol} @ ${execution_price:.2f} (slippage={slippage_bps}bps)",
            symbol=symbol,
            data=trade_record,
            level="success",
        )

        # Broadcast trade event
        if self._broadcast_fn:
            await self._broadcast_fn({
                "type": "agent_trade",
                "trade": trade_record,
            })

        return {**result, "execution_price": execution_price, "agent_trade": trade_record}

    def get_execution_history(self, limit: int = 50) -> List[Dict]:
        return list(reversed(self._execution_history))[:limit]

    def get_status(self) -> Dict:
        base = super().get_status()
        base.update({
            "total_trades": self.total_trades,
            "pending_trades": len(self._pending_trades),
            "recent_executions": self.get_execution_history(5),
        })
        return base
