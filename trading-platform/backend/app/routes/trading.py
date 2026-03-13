from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, validator
from typing import Optional
import logging

from app.database import get_db
from app.routes.auth import get_current_user
from app.models import User
from app.services.trading_service import (
    execute_trade, get_portfolio_summary,
    get_trade_history, update_portfolio_prices, InsufficientFundsError, InvalidTradeError
)
from app.services.market_data import fetch_quote
from app.ai.trading_agent import get_trading_agent
from app.services.market_data import fetch_history
from app.services.news_service import fetch_symbol_news

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/trading", tags=["trading"])


class TradeRequest(BaseModel):
    symbol: str
    market: str
    action: str  # BUY or SELL
    quantity: float
    price: Optional[float] = None  # If None, use market price

    @validator("action")
    def validate_action(cls, v):
        if v.upper() not in ("BUY", "SELL"):
            raise ValueError("action must be BUY or SELL")
        return v.upper()

    @validator("quantity")
    def validate_quantity(cls, v):
        if v <= 0:
            raise ValueError("quantity must be positive")
        return v


class AITradeRequest(BaseModel):
    symbol: str
    market: str


@router.post("/execute")
async def manual_trade(
    request: TradeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute a manual trade (paper trading)"""
    # Get current market price
    price = request.price
    if not price:
        quote = await fetch_quote(request.symbol)
        if not quote or not quote.get("price"):
            raise HTTPException(status_code=404, detail=f"Cannot get price for {request.symbol}")
        price = quote["price"]

    if price <= 0:
        raise HTTPException(status_code=400, detail="Invalid price")

    try:
        result = await execute_trade(
            user_id=current_user.id,
            symbol=request.symbol,
            market=request.market,
            action=request.action,
            quantity=request.quantity,
            price=price,
            db=db,
            is_ai_trade=False,
        )
        return {"success": True, **result}
    except InsufficientFundsError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except InvalidTradeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ai-trade")
async def ai_execute_trade(
    request: AITradeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Let the AI analyze and execute a trade automatically.
    The AI decides BUY/SELL/HOLD and position size.
    """
    # Get data
    df = await fetch_history(request.symbol, period="3mo", interval="1d")
    news = await fetch_symbol_news(request.symbol, limit=20)
    quote = await fetch_quote(request.symbol)

    if not quote or not quote.get("price"):
        raise HTTPException(status_code=404, detail=f"Cannot get price for {request.symbol}")

    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No historical data for {request.symbol}")

    agent = get_trading_agent()
    decision = agent.analyze(request.symbol, request.market, df, news)

    if decision.action == "HOLD":
        return {
            "success": False,
            "message": "AI recommends HOLD — no trade executed",
            "decision": {
                "action": decision.action,
                "confidence": decision.confidence,
                "reasoning": decision.reasoning,
            },
        }

    # Get portfolio to calculate position size in dollars
    from app.services.trading_service import get_or_create_portfolio
    portfolio = await get_or_create_portfolio(current_user.id, db)

    price = quote["price"]
    max_dollars = portfolio.total_value * decision.position_size
    quantity = max_dollars / price if price > 0 else 0

    if quantity < 0.001:
        return {
            "success": False,
            "message": "Position too small to trade",
            "decision": {"action": decision.action, "confidence": decision.confidence},
        }

    # Round appropriately
    is_crypto = request.market == "CRYPTO"
    quantity = round(quantity, 6) if is_crypto else round(quantity, 2)

    try:
        result = await execute_trade(
            user_id=current_user.id,
            symbol=request.symbol,
            market=request.market,
            action=decision.action,
            quantity=quantity,
            price=price,
            db=db,
            is_ai_trade=True,
            ai_confidence=decision.confidence,
            ai_reasoning=decision.reasoning,
        )
        return {
            "success": True,
            "ai_decision": {
                "action": decision.action,
                "confidence": decision.confidence,
                "reasoning": decision.reasoning,
                "target_price": decision.target_price,
                "stop_loss": decision.stop_loss,
                "risk_reward": decision.risk_reward_ratio,
            },
            **result,
        }
    except (InsufficientFundsError, InvalidTradeError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/portfolio")
async def get_portfolio(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current portfolio summary"""
    return await get_portfolio_summary(current_user.id, db)


@router.get("/history")
async def trade_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get trade history"""
    return await get_trade_history(current_user.id, db, limit=limit)


@router.post("/refresh-prices")
async def refresh_portfolio_prices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Refresh all portfolio position prices"""
    portfolio = await get_portfolio_summary(current_user.id, db)
    symbols = [p["symbol"] for p in portfolio.get("positions", [])]

    if not symbols:
        return {"message": "No positions to update"}

    from app.services.market_data import fetch_multiple_quotes
    quotes = await fetch_multiple_quotes(symbols)
    prices = {q["symbol"]: q["price"] for q in quotes if q.get("price")}

    return await update_portfolio_prices(current_user.id, db, prices)
