from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import logging

from app.services.market_data import (
    fetch_quote, fetch_history, fetch_multiple_quotes,
    get_market_overview, get_all_symbols_list, get_symbols_for_market,
    history_to_chart_data,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/market", tags=["market"])


@router.get("/overview")
async def market_overview():
    """Get market overview: major indices for US, India, Crypto"""
    return await get_market_overview()


@router.get("/symbols")
async def all_symbols():
    """Get all tracked symbols organized by market"""
    return get_all_symbols_list()


@router.get("/symbols/{market}")
async def symbols_by_market(market: str):
    """Get symbols for a specific market (US, INDIA, CRYPTO)"""
    symbols = get_symbols_for_market(market)
    if not symbols:
        raise HTTPException(status_code=404, detail=f"Market '{market}' not found")
    return symbols


@router.get("/quotes")
async def batch_quotes(
    symbols: str = Query(..., description="Comma-separated list of symbols")
):
    """Get quotes for multiple symbols"""
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        raise HTTPException(status_code=400, detail="No symbols provided")
    if len(symbol_list) > 30:
        raise HTTPException(status_code=400, detail="Too many symbols (max 30)")
    return await fetch_multiple_quotes(symbol_list)


@router.get("/quote/{symbol}")
async def get_quote(symbol: str):
    """Get real-time quote for a symbol"""
    quote = await fetch_quote(symbol)
    if not quote:
        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not found")
    return quote


@router.get("/history/{symbol}")
async def get_history(
    symbol: str,
    period: str = Query("3mo", description="Time period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y"),
    interval: str = Query("1d", description="Interval: 1m, 5m, 15m, 30m, 1h, 1d, 1wk, 1mo"),
):
    """Get historical OHLCV data for charts"""
    df = await fetch_history(symbol, period=period, interval=interval)
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for '{symbol}'")
    return history_to_chart_data(df)


@router.get("/screener")
async def screener(
    market: str = Query("US", description="Market: US, INDIA, CRYPTO"),
    min_change: Optional[float] = None,
    max_change: Optional[float] = None,
):
    """Screen stocks by criteria"""
    symbols_info = get_symbols_for_market(market)
    symbols = [s["symbol"] for s in symbols_info]
    quotes = await fetch_multiple_quotes(symbols)

    if min_change is not None:
        quotes = [q for q in quotes if q.get("change_pct", 0) >= min_change]
    if max_change is not None:
        quotes = [q for q in quotes if q.get("change_pct", 0) <= max_change]

    quotes.sort(key=lambda x: abs(x.get("change_pct", 0)), reverse=True)
    return quotes
