"""
Goal Tracking Agent
Monitors progress toward user's return target.
Dynamically adjusts:
  - Risk appetite (more aggressive when behind, conservative when near goal)
  - Symbol selection (higher beta when behind schedule)
  - Position sizing
"""
from typing import Dict, Optional, List
from datetime import datetime, timedelta
from .base import BaseAgent
from app.services.live_feed import live_feed


class GoalAgent(BaseAgent):
    """Tracks portfolio goal and dynamically adjusts trading strategy"""

    def __init__(self):
        super().__init__(name="goal_agent", interval_seconds=30.0)
        self.config: Optional[Dict] = None
        self.progress_history: List[Dict] = []
        self.current_strategy = "balanced"  # conservative | balanced | aggressive
        self.risk_multiplier = 1.0

    def set_goal(self, deposit: float, target_return_pct: float,
                 days_to_goal: int = 30, risk_tolerance: str = "moderate"):
        """Configure the goal"""
        self.config = {
            "deposit": deposit,
            "target_return_pct": target_return_pct,
            "target_value": deposit * (1 + target_return_pct / 100),
            "days_to_goal": days_to_goal,
            "risk_tolerance": risk_tolerance,
            "start_date": datetime.utcnow().isoformat(),
            "deadline": (datetime.utcnow() + timedelta(days=days_to_goal)).isoformat(),
        }

    def clear_goal(self):
        self.config = None
        self.current_strategy = "balanced"
        self.risk_multiplier = 1.0

    async def run(self):
        if not self.config:
            return

        # This will be called by orchestrator with portfolio info
        await self._emit(
            "goal_check",
            f"Monitoring goal: {self.config['target_return_pct']}% return on ${self.config['deposit']:,.0f}",
            data={"target": self.config["target_value"], "strategy": self.current_strategy},
        )

    def evaluate(self, portfolio: Dict) -> Dict:
        """Evaluate goal progress and determine strategy adjustments"""
        if not self.config:
            return {"strategy": "balanced", "risk_multiplier": 1.0, "on_track": True}

        total = portfolio.get("total_value", self.config["deposit"])
        deposit = self.config["deposit"]
        target = self.config["target_value"]
        current_return_pct = ((total - deposit) / deposit * 100) if deposit > 0 else 0
        target_return_pct = self.config["target_return_pct"]

        # Time progress
        start = datetime.fromisoformat(self.config["start_date"])
        deadline = datetime.fromisoformat(self.config["deadline"])
        total_days = (deadline - start).days
        elapsed_days = (datetime.utcnow() - start).days
        time_progress_pct = elapsed_days / max(total_days, 1) * 100

        # Return progress
        return_progress_pct = current_return_pct / max(target_return_pct, 0.01) * 100

        # Determine if on-track
        on_track = return_progress_pct >= time_progress_pct * 0.8

        # Strategy
        gap = time_progress_pct - return_progress_pct
        if gap > 20:
            strategy = "aggressive"
            risk_multiplier = 1.5
        elif gap > 5:
            strategy = "growth"
            risk_multiplier = 1.2
        elif gap < -15:
            strategy = "conservative"
            risk_multiplier = 0.6
        elif total >= target:
            strategy = "capital_preservation"
            risk_multiplier = 0.3
        else:
            strategy = "balanced"
            risk_multiplier = 1.0

        # Apply risk tolerance cap
        tol = self.config.get("risk_tolerance", "moderate")
        if tol == "conservative":
            risk_multiplier = min(risk_multiplier, 0.7)
        elif tol == "aggressive":
            risk_multiplier = min(risk_multiplier, 2.0)

        self.current_strategy = strategy
        self.risk_multiplier = risk_multiplier

        progress = {
            "deposit": deposit,
            "current_value": total,
            "target_value": target,
            "current_return_pct": round(current_return_pct, 2),
            "target_return_pct": target_return_pct,
            "return_progress_pct": round(return_progress_pct, 2),
            "time_progress_pct": round(time_progress_pct, 1),
            "on_track": on_track,
            "strategy": strategy,
            "risk_multiplier": risk_multiplier,
            "days_remaining": max(0, total_days - elapsed_days),
            "pnl": round(total - deposit, 2),
            "pnl_pct": round(current_return_pct, 2),
        }
        self.progress_history.append({**progress, "timestamp": datetime.utcnow().isoformat()})
        if len(self.progress_history) > 288:  # 24h at 5-min intervals
            self.progress_history = self.progress_history[-288:]

        return progress

    def get_preferred_symbols(self) -> List[str]:
        """Return preferred symbols based on current strategy"""
        if self.current_strategy in ("aggressive", "growth"):
            return ["NVDA", "TSLA", "SOL-USD", "ETH-USD", "META", "AMZN"]
        elif self.current_strategy == "conservative":
            return ["SPY", "QQQ", "AAPL", "MSFT", "V", "JNJ"]
        elif self.current_strategy == "capital_preservation":
            return []  # No new trades
        else:
            return ["AAPL", "MSFT", "NVDA", "BTC-USD", "SPY"]

    def get_status(self) -> Dict:
        base = super().get_status()
        base.update({
            "config": self.config,
            "current_strategy": self.current_strategy,
            "risk_multiplier": self.risk_multiplier,
        })
        return base
