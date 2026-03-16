"""
Auto-Trader API Routes
Manage autonomous trading sessions with goal-based configuration.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, validator
from typing import Optional
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
