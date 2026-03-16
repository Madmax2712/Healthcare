"""
Position Monitor Agent
Continuously monitors open positions and triggers:
  - Stop-loss exits
  - Take-profit exits
  - Trailing stop updates
  - Position P&L alerts
"""
import asyncio
from typing import Dict, List, Optional
from datetime import datetime
from .base import BaseAgent
from app.services.live_feed import live_feed


class PositionMonitorAgent(BaseAgent):
    """Monitors positions and triggers exits at stop-loss / take-profit levels"""

    def __init__(self):
        super().__init__(name="position_monitor", interval_seconds=3.0)
        self._positions: Dict[str, Dict] = {}   # symbol → position info
        self._stop_prices: Dict[str, float] = {} # symbol → current stop price
        self._target_prices: Dict[str, Dict] = {} # symbol → {t1, t2, t3}
        self._trailing_stops: Dict[str, float] = {}
        self.exits_triggered = 0
        self._exit_queue: List[Dict] = []
        self._user_id: Optional[int] = None
        self._db_session_factory = None

    def set_user(self, user_id: int):
        self._user_id = user_id

    def set_db_factory(self, factory):
        self._db_session_factory = factory

    def register_position(self, symbol: str, entry_price: float,
                           quantity: float, market: str,
                           stop_loss: float, target_price: float):
        """Register a position for monitoring"""
        self._positions[symbol] = {
            "symbol": symbol,
            "market": market,
            "entry_price": entry_price,
            "quantity": quantity,
            "stop_loss_initial": stop_loss,
            "target_price": target_price,
            "registered_at": datetime.utcnow().isoformat(),
        }
        self._stop_prices[symbol] = stop_loss
        self._target_prices[symbol] = {
            "t1": target_price,
            "t2": target_price * 1.03,
        }
        # Trailing stop at 2% below entry
        self._trailing_stops[symbol] = entry_price * 0.98

    def unregister_position(self, symbol: str):
        for d in [self._positions, self._stop_prices, self._target_prices, self._trailing_stops]:
            d.pop(symbol, None)

    async def run(self):
        if not self._positions:
            return

        exits = []
        for symbol, pos in list(self._positions.items()):
            current_price = live_feed.get_latest_price(symbol)
            if not current_price:
                continue

            entry = pos["entry_price"]
            stop = self._stop_prices.get(symbol, entry * 0.95)
            target = self._target_prices.get(symbol, {}).get("t1", entry * 1.08)
            trailing = self._trailing_stops.get(symbol, stop)
            market = pos.get("market", "US")

            # Update trailing stop: rise with price
            new_trailing = max(trailing, current_price * 0.97)
            self._trailing_stops[symbol] = new_trailing

            pnl_pct = (current_price - entry) / entry * 100

            # Check exits
            exit_reason = None
            if current_price <= stop:
                exit_reason = f"Stop-loss hit: ${current_price:.2f} ≤ ${stop:.2f}"
            elif current_price <= new_trailing and pnl_pct > 2:
                exit_reason = f"Trailing stop hit: ${current_price:.2f} ≤ ${new_trailing:.2f}"
            elif current_price >= target:
                exit_reason = f"Take-profit hit: ${current_price:.2f} ≥ ${target:.2f}"

            if exit_reason:
                exits.append({
                    "symbol": symbol,
                    "market": market,
                    "price": current_price,
                    "quantity": pos["quantity"],
                    "reason": exit_reason,
                    "pnl_pct": round(pnl_pct, 2),
                })
                self.unregister_position(symbol)
                self.exits_triggered += 1
                await self._emit("exit_triggered", exit_reason, symbol=symbol,
                                 data={"price": current_price, "pnl_pct": pnl_pct},
                                 level="warning" if pnl_pct < 0 else "success")

                # Broadcast exit signal
                if self._broadcast_fn:
                    await self._broadcast_fn({
                        "type": "position_exit",
                        "symbol": symbol,
                        "reason": exit_reason,
                        "price": current_price,
                        "pnl_pct": pnl_pct,
                    })

        # Return exits for orchestrator to act on
        self._exit_queue.extend(exits)

    def pop_exits(self) -> List[Dict]:
        exits = self._exit_queue.copy()
        self._exit_queue.clear()
        return exits

    def get_monitored_positions(self) -> List[Dict]:
        result = []
        for symbol, pos in self._positions.items():
            current = live_feed.get_latest_price(symbol)
            entry = pos["entry_price"]
            pnl_pct = ((current - entry) / entry * 100) if current and entry else 0
            result.append({
                **pos,
                "current_price": current,
                "pnl_pct": round(pnl_pct, 2),
                "stop_price": self._stop_prices.get(symbol),
                "target_price": self._target_prices.get(symbol, {}).get("t1"),
                "trailing_stop": self._trailing_stops.get(symbol),
            })
        return result

    def get_status(self) -> Dict:
        base = super().get_status()
        base.update({
            "monitored_positions": len(self._positions),
            "exits_triggered": self.exits_triggered,
            "positions": self.get_monitored_positions(),
        })
        return base
