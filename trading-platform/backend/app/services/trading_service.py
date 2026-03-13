"""
Paper Trading Engine
Handles all trade execution, portfolio management, and P&L tracking
"""
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import logging

from app.models import Portfolio, Position, Trade, User
from app.config import settings

logger = logging.getLogger(__name__)


class TradingError(Exception):
    pass


class InsufficientFundsError(TradingError):
    pass


class InvalidTradeError(TradingError):
    pass


async def get_or_create_portfolio(user_id: int, db: AsyncSession) -> Portfolio:
    result = await db.execute(select(Portfolio).where(Portfolio.user_id == user_id))
    portfolio = result.scalar_one_or_none()

    if not portfolio:
        portfolio = Portfolio(
            user_id=user_id,
            cash_balance=settings.INITIAL_BALANCE,
            total_value=settings.INITIAL_BALANCE,
        )
        db.add(portfolio)
        await db.commit()
        await db.refresh(portfolio)

    return portfolio


async def execute_trade(
    user_id: int,
    symbol: str,
    market: str,
    action: str,
    quantity: float,
    price: float,
    db: AsyncSession,
    is_ai_trade: bool = False,
    ai_confidence: float = 0.0,
    ai_reasoning: str = "",
) -> Dict:
    """Execute a paper trade"""
    portfolio = await get_or_create_portfolio(user_id, db)
    total_value = quantity * price

    if action == "BUY":
        # Check sufficient funds
        if portfolio.cash_balance < total_value:
            raise InsufficientFundsError(
                f"Insufficient funds: need ${total_value:.2f}, have ${portfolio.cash_balance:.2f}"
            )

        # Update or create position
        result = await db.execute(
            select(Position).where(
                Position.portfolio_id == portfolio.id,
                Position.symbol == symbol,
            )
        )
        position = result.scalar_one_or_none()

        if position:
            # Average up/down
            total_qty = position.quantity + quantity
            total_cost = (position.quantity * position.avg_cost) + total_value
            position.avg_cost = total_cost / total_qty
            position.quantity = total_qty
        else:
            position = Position(
                portfolio_id=portfolio.id,
                symbol=symbol,
                market=market,
                quantity=quantity,
                avg_cost=price,
                current_price=price,
                market_value=total_value,
            )
            db.add(position)

        portfolio.cash_balance -= total_value

    elif action == "SELL":
        result = await db.execute(
            select(Position).where(
                Position.portfolio_id == portfolio.id,
                Position.symbol == symbol,
            )
        )
        position = result.scalar_one_or_none()

        if not position or position.quantity < quantity:
            raise InvalidTradeError(
                f"Cannot sell {quantity} of {symbol}: only have {getattr(position, 'quantity', 0)}"
            )

        position.quantity -= quantity
        portfolio.cash_balance += total_value

        if position.quantity <= 0:
            await db.delete(position)

    else:
        raise InvalidTradeError(f"Unknown action: {action}")

    # Record trade
    trade = Trade(
        user_id=user_id,
        symbol=symbol,
        market=market,
        action=action,
        quantity=quantity,
        price=price,
        total_value=total_value,
        status="EXECUTED",
        ai_confidence=ai_confidence,
        ai_reasoning=ai_reasoning,
        is_ai_trade=is_ai_trade,
    )
    db.add(trade)

    await db.commit()
    await db.refresh(portfolio)

    return {
        "trade_id": trade.id if hasattr(trade, "id") else None,
        "symbol": symbol,
        "action": action,
        "quantity": quantity,
        "price": price,
        "total_value": round(total_value, 2),
        "status": "EXECUTED",
        "cash_balance": round(portfolio.cash_balance, 2),
        "timestamp": datetime.utcnow().isoformat(),
    }


async def update_portfolio_prices(
    user_id: int, db: AsyncSession, current_prices: Dict[str, float]
) -> Dict:
    """Update all position prices and recalculate P&L"""
    portfolio = await get_or_create_portfolio(user_id, db)

    result = await db.execute(
        select(Position).where(Position.portfolio_id == portfolio.id)
    )
    positions = result.scalars().all()

    total_market_value = portfolio.cash_balance

    for position in positions:
        price = current_prices.get(position.symbol, position.current_price)
        if price > 0:
            position.current_price = price
            position.market_value = position.quantity * price
            position.unrealized_pnl = (price - position.avg_cost) * position.quantity
            position.unrealized_pnl_pct = (
                (price - position.avg_cost) / position.avg_cost * 100
                if position.avg_cost > 0 else 0
            )
        total_market_value += position.market_value or 0

    portfolio.total_value = total_market_value
    portfolio.total_pnl = total_market_value - settings.INITIAL_BALANCE

    await db.commit()

    return {
        "total_value": round(portfolio.total_value, 2),
        "cash_balance": round(portfolio.cash_balance, 2),
        "total_pnl": round(portfolio.total_pnl, 2),
        "total_pnl_pct": round(portfolio.total_pnl / settings.INITIAL_BALANCE * 100, 2),
    }


async def get_portfolio_summary(user_id: int, db: AsyncSession) -> Dict:
    """Get complete portfolio summary"""
    portfolio = await get_or_create_portfolio(user_id, db)

    result = await db.execute(
        select(Position).where(Position.portfolio_id == portfolio.id)
    )
    positions = result.scalars().all()

    positions_data = [
        {
            "symbol": p.symbol,
            "market": p.market,
            "quantity": round(p.quantity, 6),
            "avg_cost": round(p.avg_cost, 4),
            "current_price": round(p.current_price, 4),
            "market_value": round(p.market_value or 0, 2),
            "unrealized_pnl": round(p.unrealized_pnl or 0, 2),
            "unrealized_pnl_pct": round(p.unrealized_pnl_pct or 0, 2),
        }
        for p in positions
    ]

    invested_value = sum(p["market_value"] for p in positions_data)

    return {
        "cash_balance": round(portfolio.cash_balance, 2),
        "invested_value": round(invested_value, 2),
        "total_value": round(portfolio.total_value or (portfolio.cash_balance + invested_value), 2),
        "total_pnl": round(portfolio.total_pnl or 0, 2),
        "total_pnl_pct": round(
            (portfolio.total_pnl or 0) / settings.INITIAL_BALANCE * 100, 2
        ),
        "positions": positions_data,
        "positions_count": len(positions_data),
    }


async def get_trade_history(user_id: int, db: AsyncSession, limit: int = 50) -> List[Dict]:
    """Get recent trade history"""
    result = await db.execute(
        select(Trade)
        .where(Trade.user_id == user_id)
        .order_by(Trade.created_at.desc())
        .limit(limit)
    )
    trades = result.scalars().all()

    return [
        {
            "id": t.id,
            "symbol": t.symbol,
            "market": t.market,
            "action": t.action,
            "quantity": t.quantity,
            "price": round(t.price, 4),
            "total_value": round(t.total_value, 2),
            "status": t.status,
            "is_ai_trade": t.is_ai_trade,
            "ai_confidence": round(t.ai_confidence or 0, 4),
            "timestamp": t.created_at.isoformat() if t.created_at else None,
        }
        for t in trades
    ]
