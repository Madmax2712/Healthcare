"""
Risk Management Agent
Validates every trade proposal against:
  - Max position size limits
  - Daily loss limits
  - Portfolio concentration rules
  - Goal-based risk scaling
  - Drawdown protection
"""
from typing import Dict, Optional, Tuple
from .base import BaseAgent


class RiskAgent(BaseAgent):
    """Validates trade proposals and enforces risk limits"""

    def __init__(self):
        super().__init__(name="risk_agent", interval_seconds=15.0)
        self.max_position_pct = 0.15      # Max 15% per position
        self.max_daily_loss_pct = 0.05    # Stop auto-trading at 5% daily loss
        self.max_portfolio_positions = 15 # Max concurrent positions
        self.min_confidence = 0.45        # Minimum AI confidence to trade
        self.max_drawdown_pct = 0.20      # Pause if >20% drawdown from peak
        self._daily_loss = 0.0
        self._peak_value = 0.0
        self._portfolio_value = 0.0
        self.approved_today = 0
        self.rejected_today = 0

    async def run(self):
        """Periodic health check"""
        await self._emit(
            "health_check",
            f"Daily loss: {self._daily_loss:.2%} | Approved: {self.approved_today} | Rejected: {self.rejected_today}",
            data={
                "daily_loss_pct": round(self._daily_loss * 100, 3),
                "approved": self.approved_today,
                "rejected": self.rejected_today,
            }
        )

    def update_portfolio(self, portfolio: Dict):
        """Called whenever portfolio value updates"""
        total = portfolio.get("total_value", 0)
        self._portfolio_value = total
        if total > self._peak_value:
            self._peak_value = total

    def validate_trade(
        self,
        symbol: str,
        action: str,
        confidence: float,
        position_size_pct: float,
        portfolio: Dict,
        goal_config: Optional[Dict] = None,
    ) -> Tuple[bool, str, float]:
        """
        Returns: (approved: bool, reason: str, adjusted_position_pct: float)
        """
        total_value = portfolio.get("total_value", 0)
        cash = portfolio.get("cash_balance", 0)
        positions = portfolio.get("positions", [])
        initial_balance = portfolio.get("initial_balance", total_value)

        # 1. Confidence gate
        if confidence < self.min_confidence:
            self.rejected_today += 1
            return False, f"Confidence {confidence:.0%} < minimum {self.min_confidence:.0%}", 0

        # 2. Daily loss limit
        daily_pnl_pct = portfolio.get("daily_pnl", 0) / max(total_value, 1)
        if daily_pnl_pct < -self.max_daily_loss_pct:
            self.rejected_today += 1
            return False, f"Daily loss limit hit ({daily_pnl_pct:.2%}). Auto-trading paused.", 0

        # 3. Drawdown protection
        if self._peak_value > 0:
            drawdown = (self._peak_value - total_value) / self._peak_value
            if drawdown > self.max_drawdown_pct:
                self.rejected_today += 1
                return False, f"Portfolio drawdown {drawdown:.2%} exceeds {self.max_drawdown_pct:.0%} limit", 0

        # 4. Cash check for BUY
        if action == "BUY":
            proposed_dollars = total_value * position_size_pct
            if proposed_dollars > cash * 0.95:
                adj = (cash * 0.90) / total_value
                if adj < 0.01:
                    self.rejected_today += 1
                    return False, "Insufficient cash balance", 0
                position_size_pct = adj

        # 5. Max positions
        if action == "BUY" and len(positions) >= self.max_portfolio_positions:
            self.rejected_today += 1
            return False, f"Max positions ({self.max_portfolio_positions}) reached", 0

        # 6. Concentration check
        adj_position_pct = min(position_size_pct, self.max_position_pct)

        # 7. Goal-based scaling — reduce risk when near goal
        if goal_config:
            target = goal_config.get("target_value", 0)
            if target > 0 and total_value >= target * 0.95:
                # Near goal: reduce risk significantly
                adj_position_pct = min(adj_position_pct, 0.03)

        self.approved_today += 1
        return True, "Trade approved", adj_position_pct

    def get_status(self) -> Dict:
        base = super().get_status()
        base.update({
            "daily_loss_pct": round(self._daily_loss * 100, 3),
            "portfolio_value": self._portfolio_value,
            "peak_value": self._peak_value,
            "approved_today": self.approved_today,
            "rejected_today": self.rejected_today,
            "limits": {
                "max_position_pct": self.max_position_pct,
                "max_daily_loss_pct": self.max_daily_loss_pct,
                "min_confidence": self.min_confidence,
                "max_positions": self.max_portfolio_positions,
            }
        })
        return base
