"""
Auto-Trader API Routes
Manage autonomous trading sessions with goal-based configuration.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, validator
from typing import Optional
from datetime import datetime
import logging

from app.database import get_db
from app.routes.auth import get_current_user
from app.models import User
from app.agents.orchestrator import orchestrator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/autotrader", tags=["autotrader"])


class AutoTraderConfig(BaseModel):
    deposit: float
    target_return_pct: float       # e.g. 15.0 for 15%
    days_to_goal: int = 30
    risk_tolerance: str = "moderate"  # conservative | moderate | aggressive

    @validator("deposit")
    def validate_deposit(cls, v):
        if v < 100:
            raise ValueError("Minimum deposit is $100")
        return v

    @validator("target_return_pct")
    def validate_return(cls, v):
        if not (0.5 <= v <= 200):
            raise ValueError("Target return must be between 0.5% and 200%")
        return v

    @validator("days_to_goal")
    def validate_days(cls, v):
        if not (1 <= v <= 365):
            raise ValueError("Days must be 1–365")
        return v

    @validator("risk_tolerance")
    def validate_risk(cls, v):
        if v not in ("conservative", "moderate", "aggressive"):
            raise ValueError("risk_tolerance must be conservative, moderate, or aggressive")
        return v


@router.post("/start")
async def start_autotrading(
    config: AutoTraderConfig,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start autonomous trading with a goal configuration"""
    result = await orchestrator.start_autotrading(
        user_id=current_user.id,
        deposit=config.deposit,
        target_return_pct=config.target_return_pct,
        days_to_goal=config.days_to_goal,
        risk_tolerance=config.risk_tolerance,
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/stop")
async def stop_autotrading(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stop autonomous trading"""
    result = await orchestrator.stop_autotrading(current_user.id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/status")
async def get_status(
    current_user: User = Depends(get_current_user),
):
    """Get full agent system status"""
    return {
        "active": orchestrator.is_autotrading(current_user.id),
        **orchestrator.get_agent_status(current_user.id),
    }


@router.get("/opportunities")
async def get_opportunities():
    """Get current market opportunities from scanner agent"""
    return {
        "opportunities": orchestrator.get_opportunities(10),
        "signals": orchestrator.get_live_signals(10),
    }


@router.get("/signals")
async def get_live_signals():
    """Get latest AI signals from signal agent"""
    return {"signals": orchestrator.get_live_signals(20)}


@router.get("/trades")
async def get_agent_trades(
    current_user: User = Depends(get_current_user),
    limit: int = 50,
):
    """Get recent agent execution history for the current user"""
    executor = orchestrator._user_executor.get(current_user.id)
    if not executor:
        return {"trades": []}
    return {"trades": executor.get_execution_history(limit)}


@router.get("/live-signals")
async def get_live_trade_signals():
    """
    Real-time actionable trade signals (BUY/SELL).
    - Immediately populates from ALL live-feed quotes (no warm-up wait)
    - AI deep analysis signals override simple momentum signals
    - Also returns options recommendations for high-confidence signals.
    """
    from app.services.live_feed import live_feed
    from datetime import date, timedelta

    symbol_map: dict = {}

    # ── Step 1: Instant signals from every live-feed quote (available immediately) ──
    all_quotes = live_feed.get_all_quotes() if hasattr(live_feed, "get_all_quotes") else {}
    # (all_quotes used only as a warmup check; scanner_opps below is the primary source)

    # Use scanner's cached price data for all symbols
    scanner_opps = orchestrator.get_opportunities(50)  # get all opportunities
    for opp in scanner_opps:
        sym = opp.get("symbol", "")
        if not sym:
            continue
        q = live_feed.get_quote(sym)
        price = (q["price"] if q else None) or opp.get("price", 0)
        if not price:
            continue
        chg = opp.get("change_pct", 0) or (q.get("change_pct", 0) if q else 0)
        action = opp.get("action", "HOLD")
        conf   = opp.get("confidence", 0.50)
        hold   = 7 if conf >= 0.65 else 14
        today  = date.today()
        symbol_map[sym] = {
            "symbol": sym,
            "market": opp.get("market", "US"),
            "action": action,
            "confidence": conf,
            "price": price,
            "change_pct": chg,
            "target_price": opp.get("target_price") or round(price * (1.06 if action == "BUY" else 0.94), 2),
            "stop_loss":    opp.get("stop_loss")    or round(price * (0.96 if action == "BUY" else 1.04), 2),
            "expected_return_pct": opp.get("expected_return_pct", round(abs(chg) * 2, 1)),
            "risk_reward":  opp.get("risk_reward", 2.0),
            "reasoning":    opp.get("reasoning", f"Momentum: {chg:+.2f}% daily move"),
            "source":       "scanner",
            "hold_days":    hold,
            "entry_date":   today.isoformat(),
            "exit_date":    (today + timedelta(days=hold)).isoformat(),
            "timestamp":    opp.get("timestamp", datetime.utcnow().isoformat()),
        }

    # ── Step 2: Deep AI signals override scanner signals for same symbol ──
    ai_signals = orchestrator.get_live_signals(50)
    for sig in ai_signals:
        sym = sig.get("symbol", "")
        if not sym:
            continue
        q = live_feed.get_quote(sym)
        price = (q["price"] if q else None) or sig.get("price", 0)
        if not price:
            continue
        chg  = q.get("change_pct", 0) if q else 0
        hold = sig.get("hold_days", 7)
        today = date.today()
        entry = sig.get("entry_date", today.isoformat())
        exit_d = sig.get("exit_date", (today + timedelta(days=hold)).isoformat())
        symbol_map[sym] = {
            "symbol":    sym,
            "market":    sig.get("market", "US"),
            "action":    sig.get("action", "HOLD"),
            "confidence": sig.get("confidence", 0),
            "price":     price,
            "change_pct": chg,
            "target_price":        sig.get("target_price") or round(price * 1.06, 2),
            "stop_loss":           sig.get("stop_loss")    or round(price * 0.96, 2),
            "expected_return_pct": sig.get("expected_return_pct", 0),
            "risk_reward":         sig.get("risk_reward", 2.0),
            "reasoning":           sig.get("reasoning", ""),
            "source":              sig.get("source", "ai_7layer"),
            "hold_days":           hold,
            "entry_date":          entry,
            "exit_date":           exit_d,
            "timestamp":           sig.get("timestamp", datetime.utcnow().isoformat()),
        }

    # ── Step 3: If still empty, generate momentum signals from live feed directly ──
    if not symbol_map:
        from app.services.live_feed import live_feed as lf
        from app.agents.signal_agent import MARKET_OF
        raw = lf._prices if hasattr(lf, "_prices") else {}
        for sym, state in (raw.items() if hasattr(raw, "items") else []):
            try:
                q = lf.get_quote(sym)
                if not q or not q.get("price"):
                    continue
                price = q["price"]
                chg   = q.get("change_pct", 0) or 0
                action = "BUY" if chg > 0.5 else ("SELL" if chg < -0.5 else "HOLD")
                conf   = min(0.80, 0.45 + abs(chg) * 0.04)
                hold   = 7
                today  = date.today()
                symbol_map[sym] = {
                    "symbol": sym, "market": MARKET_OF.get(sym, "US"),
                    "action": action, "confidence": round(conf, 2), "price": price,
                    "change_pct": chg,
                    "target_price": round(price * (1.05 if action == "BUY" else 0.95), 2),
                    "stop_loss":    round(price * (0.97 if action == "BUY" else 1.03), 2),
                    "expected_return_pct": round(abs(chg) * 2, 1),
                    "risk_reward": 1.8, "reasoning": f"Live momentum: {chg:+.2f}% today",
                    "source": "live_feed",
                    "hold_days": hold,
                    "entry_date": today.isoformat(),
                    "exit_date": (today + timedelta(days=hold)).isoformat(),
                    "timestamp": datetime.utcnow().isoformat(),
                }
            except Exception:
                continue

    all_signals = sorted(symbol_map.values(), key=lambda x: x.get("confidence", 0), reverse=True)

    # Build options recommendations for non-HOLD signals ≥ 65% confidence
    options_recs = []
    for sig in all_signals:
        if sig["action"] not in ("BUY", "SELL"):
            continue
        conf = sig.get("confidence", 0)
        if conf < 0.60:
            continue
        price = sig.get("price", 0)
        if not price:
            continue
        is_buy = sig["action"] == "BUY"
        # Slightly OTM strike
        strike = round(price * 1.01 if is_buy else price * 0.99, 2)
        # Rough ATM premium estimate: ~2-4% of stock price for 30-day options
        est_prem_pct = 0.022 + 0.018 * conf
        est_premium = round(price * est_prem_pct, 2)
        opt_type = "CALL" if is_buy else "PUT"
        expected_ret = sig.get("expected_return_pct") or (sig.get("change_pct", 0) * 3)
        options_recs.append({
            "symbol": sig["symbol"],
            "market": sig["market"],
            "underlying_price": price,
            "signal_action": sig["action"],
            "option_type": opt_type,
            "strategy": f"Long {opt_type}",
            "strike": strike,
            "expiry_days": 30,
            "est_premium": est_premium,
            "est_premium_pct": round(est_prem_pct * 100, 1),
            "confidence": conf,
            "expected_return_pct": round(expected_ret or 5.0, 1),
            "reasoning": f"{sig['action']} signal ({conf:.0%} confidence) on {sig['symbol']} → {opt_type} play",
            "max_loss": f"${est_premium:.2f} per share (premium paid)",
            "max_gain": "Unlimited" if is_buy else f"Up to strike ${strike:.2f}",
        })

    return {
        "signals": all_signals,
        "options": options_recs[:10],
        "total_buy": sum(1 for s in all_signals if s["action"] == "BUY"),
        "total_sell": sum(1 for s in all_signals if s["action"] == "SELL"),
        "last_updated": datetime.utcnow().isoformat(),
    }
