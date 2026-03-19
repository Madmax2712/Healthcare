"""
Options Trading Routes

GET  /options/signals       — All options recommendations sorted by profit margin
GET  /options/positions     — Auto-simulated open positions with live P&L
GET  /options/closed        — Closed positions with realized P&L
GET  /options/stats         — Win rate, total P&L, best/worst trade
POST /options/simulate      — Manually open a simulated options position
DELETE /options/positions/{id} — Manually close a simulated position
"""
import logging
from datetime import date, timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Literal, Optional

from app.agents.options_simulator import options_simulator
from app.services.options_service import build_options_signal, reprice_option

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/options", tags=["options"])


# ── Models ────────────────────────────────────────────────────────────────────
class ManualSimRequest(BaseModel):
    symbol: str
    market: str = "US"
    option_type: Literal["CALL", "PUT"]
    stock_action: Literal["BUY", "SELL"]
    stock_price: float
    confidence: float = 0.70
    expected_return_pct: float = 5.0
    hold_days: int = 14
    reasoning: str = ""


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("/signals")
async def get_options_signals(
    sort_by: str = "profit",   # profit | confidence | iv
    action: str = "ALL",       # ALL | CALL | PUT
    market: str = "ALL",       # ALL | US | INDIA | CRYPTO
    min_confidence: float = 0.55,
    limit: int = 50,
):
    """
    Return options recommendations for all active stock signals.
    Sorted by expected option return % (profit margin) by default.
    Auto-populates immediately from scanner data — no warm-up needed.
    """
    from app.agents.orchestrator import orchestrator
    from app.services.live_feed import live_feed

    # Gather all signals (AI + scanner)
    sym_to_sig: dict[str, dict] = {}
    for opp in orchestrator.get_opportunities(100):
        sym = opp.get("symbol", "")
        if sym:
            sym_to_sig[sym] = opp
    for sig in orchestrator.get_live_signals(100):
        sym = sig.get("symbol", "")
        if sym:
            sym_to_sig[sym] = sig

    # Fallback: live feed direct scan if empty
    if not sym_to_sig:
        raw = getattr(live_feed, "_prices", {})
        from app.agents.signal_agent import MARKET_OF
        for sym in list(raw.keys())[:80]:
            q = live_feed.get_quote(sym)
            if not q or not q.get("price"):
                continue
            chg = q.get("change_pct", 0) or 0
            sym_to_sig[sym] = {
                "symbol": sym,
                "market": MARKET_OF.get(sym, "US"),
                "action": "BUY" if chg > 0.3 else ("SELL" if chg < -0.3 else "HOLD"),
                "confidence": min(0.75, 0.48 + abs(chg) * 0.05),
                "price": q["price"],
                "change_pct": chg,
                "expected_return_pct": abs(chg) * 1.5,
                "hold_days": 14,
            }

    today = date.today()
    options_list = []

    for sym, sig in sym_to_sig.items():
        stock_action = sig.get("action", "HOLD")
        if stock_action not in ("BUY", "SELL"):
            continue
        conf = sig.get("confidence", 0)
        if conf < min_confidence:
            continue

        # Get live price
        q = live_feed.get_quote(sym)
        stock_price = (q["price"] if q else None) or sig.get("price", 0)
        if not stock_price or stock_price <= 0:
            continue

        hold   = sig.get("hold_days", 14)
        exp_ret = sig.get("expected_return_pct", abs(sig.get("change_pct", 2)) * 1.5)

        opt = build_options_signal(
            symbol=sym,
            market=sig.get("market", "US"),
            stock_action=stock_action,
            stock_price=stock_price,
            confidence=conf,
            expected_return_pct=max(2.0, exp_ret),
            hold_days=hold,
            entry_date=today.isoformat(),
            exit_date=sig.get("exit_date", (today + timedelta(days=hold)).isoformat()),
            reasoning=sig.get("reasoning", ""),
        )
        if not opt:
            continue

        # Filters
        if action != "ALL" and opt["option_type"] != action:
            continue
        if market != "ALL" and opt["market"] != market:
            continue

        options_list.append(opt)

    # Sort
    if sort_by == "profit":
        options_list.sort(key=lambda x: x.get("expected_option_return_pct", 0), reverse=True)
    elif sort_by == "confidence":
        options_list.sort(key=lambda x: x.get("confidence", 0), reverse=True)
    elif sort_by == "iv":
        options_list.sort(key=lambda x: x.get("iv", 0), reverse=True)

    return {
        "options": options_list[:limit],
        "total":   len(options_list),
        "calls":   sum(1 for o in options_list if o["option_type"] == "CALL"),
        "puts":    sum(1 for o in options_list if o["option_type"] == "PUT"),
        "last_updated": datetime.utcnow().isoformat(),
    }


@router.get("/positions")
async def get_open_positions():
    """Auto-simulated open options positions with live mark-to-market P&L."""
    positions = options_simulator.get_open_positions()
    # Sort by P&L descending (best performers first)
    positions.sort(key=lambda x: x.get("pnl_pct", 0), reverse=True)
    return {
        "positions": positions,
        "count": len(positions),
        "total_pnl": round(sum(p.get("pnl", 0) for p in positions), 2),
    }


@router.get("/closed")
async def get_closed_positions(limit: int = 50):
    """Closed options positions with realized P&L."""
    positions = options_simulator.get_closed_positions(limit)
    positions.sort(key=lambda x: x.get("exit_time", ""), reverse=True)
    wins   = [p for p in positions if p.get("pnl", 0) > 0]
    losses = [p for p in positions if p.get("pnl", 0) <= 0]
    return {
        "positions": positions,
        "realized_pnl": round(sum(p.get("pnl", 0) for p in positions), 2),
        "win_count":  len(wins),
        "loss_count": len(losses),
    }


@router.get("/stats")
async def get_options_stats():
    """Aggregate statistics for the auto-simulator."""
    return options_simulator.get_stats()


@router.post("/simulate")
async def manually_simulate(req: ManualSimRequest):
    """Manually trigger a simulated options position (bypasses auto-scan)."""
    from datetime import date, timedelta
    today = date.today()

    opt = build_options_signal(
        symbol=req.symbol,
        market=req.market,
        stock_action=req.stock_action,
        stock_price=req.stock_price,
        confidence=req.confidence,
        expected_return_pct=req.expected_return_pct,
        hold_days=req.hold_days,
        entry_date=today.isoformat(),
        exit_date=(today + timedelta(days=req.hold_days)).isoformat(),
        reasoning=req.reasoning or "Manual simulation",
    )
    if not opt:
        raise HTTPException(status_code=400, detail="Could not build options signal")

    from app.agents.options_simulator import OptionsPosition
    pos = OptionsPosition(opt)
    options_simulator._open.append(pos)
    return {"success": True, "position": pos.to_dict()}


@router.delete("/positions/{position_id}")
async def close_position(position_id: str):
    """Manually close a simulated options position."""
    closed = options_simulator.manually_close(position_id)
    if not closed:
        raise HTTPException(status_code=404, detail=f"Position {position_id} not found")
    return {"success": True, "message": f"Position {position_id} closed"}
