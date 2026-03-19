"""
Options Auto-Simulator Agent

Autonomously:
 1. Monitors live signals every 30 seconds
 2. Auto-opens simulated options positions for high-confidence signals
 3. Marks positions to market using Black-Scholes repricing
 4. Auto-closes positions on stop-loss (-50%), target hit, or expiry
 5. Broadcasts updates via WebSocket

No user action needed — just watch and mirror the positions in real life.
"""
import asyncio
import logging
import uuid
from datetime import date, datetime, timedelta
from typing import Optional

from app.services.options_service import build_options_signal, reprice_option

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
MIN_CONFIDENCE        = 0.58    # open position when confidence >= this
MAX_OPEN_POSITIONS    = 15      # never hold more than this many contracts
STOP_LOSS_PCT         = -50.0   # close if option lost 50% of premium
TARGET_HIT_BUFFER_PCT =  5.0    # close when option gain >= expected_option_return * 0.85
AUTO_RUN_INTERVAL_S   = 30      # seconds between scans


class OptionsPosition:
    __slots__ = (
        "id", "symbol", "market", "option_type", "strategy", "strike",
        "expiry_date", "expiry_days_at_entry", "entry_premium", "target_premium",
        "contracts", "notional", "entry_time", "entry_date",
        "underlying_entry", "underlying_target",
        "iv", "confidence", "reasoning", "mirror_instruction",
        "delta", "gamma", "theta", "vega",
        "current_premium", "pnl", "pnl_pct",
        "status", "exit_time", "exit_reason", "exit_premium",
        "days_remaining",
    )

    def __init__(self, sig: dict):
        self.id                   = str(uuid.uuid4())[:8]
        self.symbol               = sig["symbol"]
        self.market               = sig["market"]
        self.option_type          = sig["option_type"]        # CALL | PUT
        self.strategy             = sig["strategy"]
        self.strike               = sig["strike"]
        self.expiry_date          = sig["expiry_date"]
        self.expiry_days_at_entry = sig["expiry_days"]
        self.entry_premium        = sig["entry_premium"]
        self.target_premium       = sig["target_premium"]
        self.contracts            = sig["contracts_for_500"]
        self.notional             = sig["notional"]
        self.entry_time           = datetime.utcnow().isoformat()
        self.entry_date           = sig["entry_date"]
        self.underlying_entry     = sig["underlying_price"]
        self.underlying_target    = sig["underlying_target"]
        self.iv                   = sig["iv"]
        self.confidence           = sig["confidence"]
        self.reasoning            = sig["reasoning"]
        self.mirror_instruction   = sig["mirror_instruction"]
        self.delta                = sig["delta"]
        self.gamma                = sig["gamma"]
        self.theta                = sig["theta"]
        self.vega                 = sig["vega"]
        # live fields
        self.current_premium      = self.entry_premium
        self.pnl                  = 0.0
        self.pnl_pct              = 0.0
        self.status               = "open"      # open | closed
        self.exit_time            = None
        self.exit_reason          = None
        self.exit_premium         = None
        self.days_remaining       = self.expiry_days_at_entry

    def to_dict(self) -> dict:
        return {
            "id":                  self.id,
            "symbol":              self.symbol,
            "market":              self.market,
            "option_type":         self.option_type,
            "strategy":            self.strategy,
            "strike":              self.strike,
            "expiry_date":         self.expiry_date,
            "expiry_days_at_entry": self.expiry_days_at_entry,
            "entry_premium":       self.entry_premium,
            "target_premium":      self.target_premium,
            "contracts":           self.contracts,
            "notional":            self.notional,
            "entry_time":          self.entry_time,
            "entry_date":          self.entry_date,
            "underlying_entry":    self.underlying_entry,
            "underlying_target":   self.underlying_target,
            "iv":                  self.iv,
            "confidence":          self.confidence,
            "reasoning":           self.reasoning,
            "mirror_instruction":  self.mirror_instruction,
            "delta":               self.delta,
            "gamma":               self.gamma,
            "theta":               self.theta,
            "vega":                self.vega,
            "current_premium":     self.current_premium,
            "pnl":                 round(self.pnl, 2),
            "pnl_pct":             round(self.pnl_pct, 2),
            "status":              self.status,
            "exit_time":           self.exit_time,
            "exit_reason":         self.exit_reason,
            "exit_premium":        self.exit_premium,
            "days_remaining":      self.days_remaining,
        }


class OptionsSimulatorAgent:
    """
    Background agent that auto-simulates options trades.
    Runs autonomously — no user action required.
    """

    def __init__(self):
        self._open: list[OptionsPosition]   = []
        self._closed: list[OptionsPosition] = []
        self._seen_signals: set[str]        = set()   # symbol+type keys to avoid dupes
        self._running = False
        self._task: Optional[asyncio.Task]  = None
        self._ws_broadcast = None  # injected after app starts

    # ── Public API ────────────────────────────────────────────────────────────
    def set_broadcaster(self, broadcast_fn):
        """Inject the WebSocket broadcast function from main.py"""
        self._ws_broadcast = broadcast_fn

    def get_open_positions(self) -> list[dict]:
        return [p.to_dict() for p in self._open]

    def get_closed_positions(self, limit: int = 50) -> list[dict]:
        return [p.to_dict() for p in self._closed[-limit:]]

    def get_stats(self) -> dict:
        closed = self._closed
        wins   = [p for p in closed if p.pnl > 0]
        losses = [p for p in closed if p.pnl <= 0]
        total_pnl = sum(p.pnl for p in closed)
        open_pnl  = sum(p.pnl for p in self._open)
        return {
            "open_count":   len(self._open),
            "closed_count": len(closed),
            "win_count":    len(wins),
            "loss_count":   len(losses),
            "win_rate":     round(len(wins) / max(1, len(closed)) * 100, 1),
            "total_realized_pnl":   round(total_pnl, 2),
            "open_unrealized_pnl":  round(open_pnl, 2),
            "best_trade":   max((p.pnl for p in closed), default=0.0),
            "worst_trade":  min((p.pnl for p in closed), default=0.0),
        }

    def manually_close(self, position_id: str) -> bool:
        for i, pos in enumerate(self._open):
            if pos.id == position_id:
                self._close_position(pos, reason="manual_close")
                self._open.pop(i)
                return True
        return False

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("OptionsSimulatorAgent started")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    # ── Main loop ─────────────────────────────────────────────────────────────
    async def _run_loop(self):
        # Wait for live feed to warm up
        await asyncio.sleep(15)
        while self._running:
            try:
                await self._scan_and_open()
                await self._mark_to_market()
            except Exception as e:
                logger.warning(f"OptionsSimulator loop error: {e}")
            await asyncio.sleep(AUTO_RUN_INTERVAL_S)

    async def _scan_and_open(self):
        """Check live signals and auto-open new options positions."""
        if len(self._open) >= MAX_OPEN_POSITIONS:
            return

        # Get signals from orchestrator (import here to avoid circular)
        try:
            from app.agents.orchestrator import orchestrator
            from app.services.live_feed import live_feed
        except ImportError:
            return

        signals = orchestrator.get_live_signals(60)
        scanner = orchestrator.get_opportunities(60)

        # Merge: AI signals take priority
        sym_to_sig: dict[str, dict] = {}
        for opp in scanner:
            sym = opp.get("symbol", "")
            if sym:
                sym_to_sig[sym] = opp
        for sig in signals:
            sym = sig.get("symbol", "")
            if sym:
                sym_to_sig[sym] = sig

        opened = 0
        for sym, sig in sym_to_sig.items():
            if len(self._open) + opened >= MAX_OPEN_POSITIONS:
                break
            action = sig.get("action", "HOLD")
            if action not in ("BUY", "SELL"):
                continue
            conf = sig.get("confidence", 0)
            if conf < MIN_CONFIDENCE:
                continue

            # Deduplicate: don't re-open same symbol+direction within its hold period
            key = f"{sym}_{action}"
            if key in self._seen_signals:
                continue

            # Get live price
            q = live_feed.get_quote(sym)
            price = (q["price"] if q else None) or sig.get("price", 0)
            if not price or price <= 0:
                continue

            from datetime import date, timedelta
            today = date.today()
            hold_days = sig.get("hold_days", 7)
            entry_date = today.isoformat()
            # Options leverage: a 5% stock move on a ~0.5 delta ATM call ≈ 2.5% option gain
            # per 1% stock move, but premium is ~3% of stock price → leverage ~8-15x
            # Use signal's expected_return if available, else estimate with delta leverage
            raw_stock_ret = sig.get("expected_return_pct") or abs(sig.get("change_pct", 2.0))
            exp_ret = raw_stock_ret * 8.0   # rough ATM call leverage multiplier

            opt_sig = build_options_signal(
                symbol=sym,
                market=sig.get("market", "US"),
                stock_action=action,
                stock_price=price,
                confidence=conf,
                expected_return_pct=max(2.0, exp_ret),
                hold_days=hold_days,
                entry_date=entry_date,
                exit_date=sig.get("exit_date", (today + timedelta(days=hold_days)).isoformat()),
                reasoning=sig.get("reasoning", ""),
            )
            if not opt_sig:
                continue

            pos = OptionsPosition(opt_sig)
            self._open.append(pos)
            self._seen_signals.add(key)
            opened += 1
            logger.info(
                f"OptionsSimulator AUTO-OPENED: {sym} {pos.option_type} "
                f"@${pos.strike} | premium ${pos.entry_premium} | conf {conf:.0%}"
            )
            await self._broadcast_event("options_opened", pos.to_dict())

        # Expire seen signals after hold period (rough cleanup every 50 opens)
        if len(self._seen_signals) > 200:
            self._seen_signals.clear()

    async def _mark_to_market(self):
        """Reprice all open positions; auto-close on stop-loss / target / expiry."""
        if not self._open:
            return

        try:
            from app.services.live_feed import live_feed
        except ImportError:
            return

        today = date.today()
        to_close: list[tuple[int, str]] = []

        for i, pos in enumerate(self._open):
            # Current underlying price
            q = live_feed.get_quote(pos.symbol)
            stock_price = q["price"] if q else pos.underlying_entry
            if not stock_price:
                continue

            # Days remaining until expiry
            try:
                expiry_dt = date.fromisoformat(pos.expiry_date)
                days_rem  = max(0, (expiry_dt - today).days)
            except Exception:
                days_rem = max(0, pos.expiry_days_at_entry - 7)
            pos.days_remaining = days_rem

            # Reprice with Black-Scholes
            new_prem = reprice_option(
                symbol=pos.symbol,
                market=pos.market,
                option_type=pos.option_type,
                strike=pos.strike,
                current_stock_price=stock_price,
                days_remaining=days_rem,
            )
            # Floor: never goes below $0.01
            new_prem = max(0.01, new_prem)
            pos.current_premium = round(new_prem, 4)

            # P&L per contract (100 shares)
            pnl_per_share  = (new_prem - pos.entry_premium) * pos.contracts * 100
            pos.pnl        = round(pnl_per_share, 2)
            pos.pnl_pct    = round((new_prem - pos.entry_premium) / pos.entry_premium * 100, 2)

            # Close conditions
            reason = None
            target_gain_pct = (pos.target_premium - pos.entry_premium) / pos.entry_premium * 100
            if pos.pnl_pct <= STOP_LOSS_PCT:
                reason = "stop_loss"
            elif pos.pnl_pct >= target_gain_pct * 0.85 and new_prem >= pos.target_premium * 0.85:
                reason = "target_hit"
            elif days_rem <= 0:
                reason = "expired"

            if reason:
                to_close.append((i, reason))

        # Close in reverse order (preserve indices)
        for idx, reason in reversed(to_close):
            pos = self._open[idx]
            self._close_position(pos, reason)
            self._open.pop(idx)
            await self._broadcast_event("options_closed", {**pos.to_dict(), "exit_reason": reason})

        # Broadcast aggregate update
        if self._open:
            await self._broadcast_event("options_update", {
                "open_positions": [p.to_dict() for p in self._open],
                "stats": self.get_stats(),
            })

    def _close_position(self, pos: OptionsPosition, reason: str):
        pos.status        = "closed"
        pos.exit_time     = datetime.utcnow().isoformat()
        pos.exit_reason   = reason
        pos.exit_premium  = pos.current_premium
        self._closed.append(pos)
        # Remove from seen so we can re-open same symbol later if signal refreshes
        key = f"{pos.symbol}_BUY" if pos.option_type == "CALL" else f"{pos.symbol}_SELL"
        self._seen_signals.discard(key)
        logger.info(
            f"OptionsSimulator CLOSED: {pos.symbol} {pos.option_type} | "
            f"P&L ${pos.pnl:+.2f} ({pos.pnl_pct:+.1f}%) | reason: {reason}"
        )

    async def _broadcast_event(self, event_type: str, data: dict):
        if self._ws_broadcast:
            try:
                await self._ws_broadcast({
                    "type": event_type,
                    "data": data,
                    "timestamp": datetime.utcnow().isoformat(),
                })
            except Exception:
                pass


# ── Singleton ─────────────────────────────────────────────────────────────────
options_simulator = OptionsSimulatorAgent()
