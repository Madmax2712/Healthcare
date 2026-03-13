from fastapi import APIRouter, Query
from typing import Optional
import logging

from app.services.news_service import fetch_global_news, fetch_symbol_news, get_market_sentiment_summary

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/news", tags=["news"])


@router.get("/global")
async def global_news(limit: int = Query(30, le=100)):
    """Get global financial news with sentiment"""
    return await fetch_global_news(limit=limit)


@router.get("/symbol/{symbol}")
async def symbol_news(symbol: str, limit: int = Query(10, le=30)):
    """Get news for a specific symbol"""
    return await fetch_symbol_news(symbol, limit=limit)


@router.get("/sentiment")
async def market_sentiment():
    """Get overall market sentiment summary"""
    return await get_market_sentiment_summary()
