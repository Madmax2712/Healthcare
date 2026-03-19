"""
Agent Orchestrator
The master controller that:
  1. Manages lifecycle of all sub-agents
  2. Coordinates the trading pipeline:
     Scanner → Signal → Risk → Executor
  3. Provides auto-trading start/stop per user
  4. Broadcasts all agent events via WebSocket
"""
import asyncio
import logging
from typing import Dict, List, Optional, Callable, Set
from datetime import datetime

from .base import AgentStatus
from .scanner_agent import MarketScannerAgent
from .signal_agent import SignalAgent
from .risk_agent import RiskAgent
from .executor_agent import TradeExecutorAgent
from .monitor_agent import PositionMonitorAgent
from .goal_agent import GoalAgent

logger = logging.getLogger(__name__)


class AgentOrchestrator:
    """Coordinates all trading agents for a multi-user platform"""

    def __init__(self):
        # Shared agents (market-wide)
        self.scanner = MarketScannerAgent()
        self.signal = SignalAgent()

        # Per-user agents (dict: user_id → agent)
        self._user_risk: Dict[int, RiskAgent] = {}
        self._user_executor: Dict[int, TradeExecutorAgent] = {}
        self._user_monitor: Dict[int, PositionMonitorAgent] = {}
        self._user_goal: Dict[int, GoalAgent] = {}
        self._user_configs: Dict[int, Dict] = {}
        self._autotrading_users: Set[int] = set()

        self._broadcast_fn: Optional[Callable] = None
        self._db_factory: Optional[Callable] = None
        self._pipeline_task: Optional[asyncio.Task] = None
        self._running = False
        self._started = False

    def set_broadcast(self, fn: Callable):
        """Set the WebSocket broadcast function"""
        self._broadcast_fn = fn
        self.scanner.set_broadcast(fn)
        self.signal.set_broadcast(fn)

    def set_db_factory(self, factory: Callable):
        self._db_factory = factory

    async def start(self):
        if self._started:
            return
        self._started = True
        self._running = True

        # Start shared agents
        await self.scanner.start()
        await self.signal.start()

        # Start coordination pipeline
        self._pipeline_task = asyncio.create_task(self._coordination_loop())
        logger.info("Agent orchestrator started")

    async def stop(self):
        self._running = False
        if self._pipeline_task:
            self._pipeline_task.cancel()
        await self.scanner.stop()
        await self.signal.stop()
        for uid in list(self._autotrading_users):
            await self.stop_autotrading(uid)
        logger.info("Agent orchestrator stopped")

    async def _coordination_loop(self):
        """Main pipeline: Scanner → Signal → Risk → Executor (every 3s)"""
        while self._running:
            try:
                await self._run_pipeline()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Orchestrator pipeline error: {e}", exc_info=True)
            await asyncio.sleep(3)

    async def _run_pipeline(self):
        if not self._autotrading_users:
            return

        # Queue top scanner movers for priority analysis
        scanner_opps = self.scanner.get_top_opportunities(10)
        for opp in scanner_opps[:5]:
            self.signal.queue_symbol(opp["symbol"], opp["market"])

        # Build tradeable list: ALL non-HOLD AI signals + scanner opps
        ai_signals = self.signal.get_all_signals()
        actionable = [s for s in ai_signals if s.get("action") in ("BUY", "SELL")]

        # Also include scanner opportunities that have no AI signal yet
        seen = {s["symbol"] for s in actionable}
        for opp in scanner_opps:
            if opp["symbol"] not in seen and opp.get("action") in ("BUY", "SELL"):
                actionable.append(opp)
                seen.add(opp["symbol"])

        # Sort by confidence descending, take top 8
        actionable.sort(key=lambda x: x.get("confidence", 0), reverse=True)
        opportunities = actionable[:8]

        # Process for each auto-trading user
        for user_id in list(self._autotrading_users):
            if not self._db_factory:
                continue
            try:
                await self._process_user_signals(user_id, opportunities)
            except Exception as e:
                logger.error(f"Pipeline error for user {user_id}: {e}")

    async def _process_user_signals(self, user_id: int, opportunities: List[Dict]):
        """Run signal → risk → execute pipeline for one user"""
        from app.services.trading_service import get_portfolio_summary

        executor = self._user_executor.get(user_id)
        risk = self._user_risk.get(user_id)
        monitor = self._user_monitor.get(user_id)
        goal = self._user_goal.get(user_id)

        if not (executor and risk and monitor and goal):
            return

        # Process monitor exits first
        exits = monitor.pop_exits()
        for exit_info in exits:
            try:
                async with self._db_factory() as db:
                    portfolio = await get_portfolio_summary(user_id, db)
                    # Execute the exit trade
                    await executor.execute_now(
                        user_id=user_id,
                        symbol=exit_info["symbol"],
                        market=exit_info["market"],
                        action="SELL",
                        position_size_pct=1.0,  # sell all
                        signal={"confidence": 1.0, "reasoning": exit_info["reason"], "action": "SELL"},
                        db=db,
                    )
            except Exception as e:
                logger.error(f"Exit execution failed: {e}")

        # Evaluate goal progress
        async with self._db_factory() as db:
            portfolio = await get_portfolio_summary(user_id, db)

        goal_progress = goal.evaluate(portfolio)
        risk.update_portfolio(portfolio)

        # Broadcast goal progress
        if self._broadcast_fn:
            await self._broadcast_fn({
                "type": "goal_progress",
                "user_id": user_id,
                "progress": goal_progress,
            })

        # Don't trade if capital preservation mode
        if goal.current_strategy == "capital_preservation":
            return

        # Get preferred symbols from goal agent
        preferred = goal.get_preferred_symbols()
        tradeable_opps = [o for o in opportunities if o["symbol"] in preferred] or opportunities[:5]

        for opp in tradeable_opps[:5]:
            symbol = opp["symbol"]
            market = opp["market"]

            # Use pre-vetted signal (already filtered to BUY/SELL above)
            signal = self.signal.get_signal(symbol) or opp
            if not signal or signal.get("action") == "HOLD":
                continue

            action = signal["action"]
            confidence = signal["confidence"]
            base_position_size = signal.get("position_size", 0.06)

            # Adjust by risk multiplier
            position_size = min(base_position_size * goal.risk_multiplier, 0.12)

            # Risk validation
            approved, reason, adj_size = risk.validate_trade(
                symbol=symbol,
                action=action,
                confidence=confidence,
                position_size_pct=position_size,
                portfolio=portfolio,
                goal_config=goal.config,
            )

            if not approved:
                logger.debug(f"Trade rejected for {symbol}: {reason}")
                continue

            # Execute
            try:
                async with self._db_factory() as db:
                    result = await executor.execute_now(
                        user_id=user_id,
                        symbol=symbol,
                        market=market,
                        action=action,
                        position_size_pct=adj_size,
                        signal=signal,
                        db=db,
                    )

                # Only register if execution actually succeeded
                if not result.get("success"):
                    logger.warning(f"Execution returned failure for {symbol}: {result.get('message', 'unknown')}")
                    continue

                if action == "BUY":
                    exec_price = result.get("execution_price", 0)
                    qty = result.get("agent_trade", {}).get("quantity", 0)
                    if not exec_price or not qty:
                        logger.warning(f"Missing execution price/qty for {symbol}, skipping position register")
                        continue
                    monitor.register_position(
                        symbol=symbol,
                        entry_price=exec_price,
                        quantity=qty,
                        market=market,
                        stop_loss=signal.get("stop_loss", exec_price * 0.95),
                        target_price=signal.get("target_price", exec_price * 1.08),
                    )

            except Exception as e:
                logger.error(f"Execution failed for {symbol}: {e}")

    # ──── User Autotrading Management ────

    async def start_autotrading(
        self,
        user_id: int,
        deposit: float,
        target_return_pct: float,
        days_to_goal: int = 30,
        risk_tolerance: str = "moderate",
    ) -> Dict:
        if user_id in self._autotrading_users:
            return {"success": False, "message": "Auto-trading already active"}

        # Create user agents
        risk = RiskAgent()
        executor = TradeExecutorAgent()
        monitor = PositionMonitorAgent()
        goal = GoalAgent()

        risk.set_broadcast(self._broadcast_fn)
        executor.set_broadcast(self._broadcast_fn)
        monitor.set_broadcast(self._broadcast_fn)
        goal.set_broadcast(self._broadcast_fn)

        monitor.set_user(user_id)
        goal.set_goal(deposit, target_return_pct, days_to_goal, risk_tolerance)

        await risk.start()
        await executor.start()
        await monitor.start()
        await goal.start()

        self._user_risk[user_id] = risk
        self._user_executor[user_id] = executor
        self._user_monitor[user_id] = monitor
        self._user_goal[user_id] = goal
        self._user_configs[user_id] = {
            "deposit": deposit,
            "target_return_pct": target_return_pct,
            "days_to_goal": days_to_goal,
            "risk_tolerance": risk_tolerance,
            "started_at": datetime.utcnow().isoformat(),
        }
        self._autotrading_users.add(user_id)

        logger.info(f"Auto-trading started for user {user_id}: ${deposit} → {target_return_pct}% return")

        if self._broadcast_fn:
            await self._broadcast_fn({
                "type": "autotrader_started",
                "user_id": user_id,
                "config": self._user_configs[user_id],
            })

        return {
            "success": True,
            "message": f"Auto-trading started. Target: {target_return_pct}% return in {days_to_goal} days",
            "config": self._user_configs[user_id],
            "agents": ["market_scanner", "signal_agent", "risk_agent", "trade_executor", "position_monitor", "goal_agent"],
        }

    async def stop_autotrading(self, user_id: int) -> Dict:
        if user_id not in self._autotrading_users:
            return {"success": False, "message": "Auto-trading not active"}

        for agent_dict in [self._user_risk, self._user_executor, self._user_monitor, self._user_goal]:
            agent = agent_dict.pop(user_id, None)
            if agent:
                await agent.stop()

        self._autotrading_users.discard(user_id)
        config = self._user_configs.pop(user_id, {})

        if self._broadcast_fn:
            await self._broadcast_fn({
                "type": "autotrader_stopped",
                "user_id": user_id,
            })

        return {"success": True, "message": "Auto-trading stopped", "config": config}

    def is_autotrading(self, user_id: int) -> bool:
        return user_id in self._autotrading_users

    def get_agent_status(self, user_id: Optional[int] = None) -> Dict:
        status = {
            "shared_agents": {
                "market_scanner": self.scanner.get_status(),
                "signal_agent": self.signal.get_status(),
            },
            "autotrading_users": list(self._autotrading_users),
        }
        if user_id and user_id in self._autotrading_users:
            status["user_agents"] = {
                "risk_agent": self._user_risk[user_id].get_status() if user_id in self._user_risk else {},
                "trade_executor": self._user_executor[user_id].get_status() if user_id in self._user_executor else {},
                "position_monitor": self._user_monitor[user_id].get_status() if user_id in self._user_monitor else {},
                "goal_agent": self._user_goal[user_id].get_status() if user_id in self._user_goal else {},
            }
            status["config"] = self._user_configs.get(user_id)
            goal = self._user_goal.get(user_id)
            if goal:
                status["goal_progress"] = goal.progress_history[-1] if goal.progress_history else None
        return status

    def get_live_signals(self, limit: int = 10) -> List[Dict]:
        return self.signal.get_all_signals()[:limit]

    def get_opportunities(self, limit: int = 8) -> List[Dict]:
        return self.scanner.get_top_opportunities(limit)


# Global singleton
orchestrator = AgentOrchestrator()
