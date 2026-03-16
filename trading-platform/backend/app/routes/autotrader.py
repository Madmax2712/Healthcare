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
    Real-time actionable trade signals (BUY/SELL) from the AI system.
    Merges scanner opportunities + signal-agent AI analysis.
    Also returns options recommendations for high-confidence signals.
    """
    from app.services.live_feed import live_feed

    # Pull from both sources
    ai_signals  = orchestrator.get_live_signals(30)
    scanner_ops = orchestrator.get_opportunities(20)

    # Merge: AI signal overrides scanner for same symbol
    symbol_map: dict = {}
    for opp in scanner_ops:
        sym = opp.get("symbol", "")
        if not sym:
            continue
        q = live_feed.get_quote(sym)
        price = (q["price"] if q else None) or opp.get("price", 0)
        symbol_map[sym] = {
            "symbol": sym,
            "market": opp.get("market", "US"),
            "action": opp.get("action", "HOLD"),
            "confidence": opp.get("confidence", opp.get("score", 0.5)),
            "price": price,
            "change_pct": opp.get("change_pct", 0),
            "target_price": opp.get("target_price") or round(price * 1.06, 2),
            "stop_loss": opp.get("stop_loss") or round(price * 0.96, 2),
            "expected_return_pct": opp.get("expected_return_pct", 0),
            "risk_reward": opp.get("risk_reward", opp.get("risk_reward_ratio", 2.0)),
            "reasoning": opp.get("reasoning", "Scanner momentum breakout"),
            "source": "scanner",
            "timestamp": opp.get("timestamp", datetime.utcnow().isoformat()),
        }

    for sig in ai_signals:
        sym = sig.get("symbol", "")
        if not sym:
            continue
        q = live_feed.get_quote(sym)
        price = (q["price"] if q else None) or sig.get("price", 0)
        symbol_map[sym] = {
            "symbol": sym,
            "market": sig.get("market", "US"),
            "action": sig.get("action", "HOLD"),
            "confidence": sig.get("confidence", 0),
            "price": price,
            "change_pct": q.get("change_pct", 0) if q else 0,
            "target_price": sig.get("target_price") or round(price * 1.06, 2),
            "stop_loss": sig.get("stop_loss") or round(price * 0.96, 2),
            "expected_return_pct": sig.get("expected_return_pct", 0),
            "risk_reward": sig.get("risk_reward", sig.get("risk_reward_ratio", 2.0)),
            "reasoning": sig.get("reasoning", ""),
            "source": sig.get("source", "ai_7layer"),
            "timestamp": sig.get("timestamp", datetime.utcnow().isoformat()),
        }

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
