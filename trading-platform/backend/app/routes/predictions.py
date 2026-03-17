from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from datetime import datetime, timedelta
import logging
import numpy as np

from app.services.market_data import fetch_history, fetch_quote
from app.services.news_service import fetch_symbol_news, get_market_sentiment_summary
from app.services.live_feed import live_feed
from app.ai.trading_agent import get_trading_agent
from app.ai.technical_analyzer import get_technical_analyzer
from app.routes.auth import get_current_user
from app.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/predictions", tags=["predictions"])


def _sanitize(obj):
    """Recursively convert numpy types to native Python types for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    return obj


@router.get("/signal/{symbol}")
async def get_signal(
    symbol: str,
    market: str = Query("US", description="Market: US, INDIA, CRYPTO"),
):
    """Get AI trading signal for a symbol"""
    # Fetch data
    df = await fetch_history(symbol, period="3mo", interval="1d")
    news = await fetch_symbol_news(symbol, limit=20)
    agent = get_trading_agent()

    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No price data for {symbol}")

    decision = agent.analyze(symbol, market, df, news)

    # Patch current_price with live feed (decision.current_price = yesterday's close from yfinance)
    live_quote = live_feed.get_quote(symbol)
    live_price = live_quote["price"] if live_quote else None
    if not live_price:
        q = await fetch_quote(symbol)
        live_price = q["price"] if q else None
    current_price = live_price or decision.current_price

    return _sanitize({
        "symbol": symbol,
        "market": market,
        "action": decision.action,
        "confidence": decision.confidence,
        "is_high_confidence": decision.is_high_confidence,
        "layers_passed": decision.layers_passed,
        "layers_total": decision.layers_total,
        "reasoning": decision.reasoning,
        "why_filtered": decision.why_filtered,
        "current_price": current_price,
        "predicted_price": decision.predicted_price,
        "target_price": decision.target_price,
        "stop_loss": decision.stop_loss,
        "expected_return_pct": decision.expected_return_pct,
        "risk_reward_ratio": decision.risk_reward_ratio,
        "position_size": decision.position_size,
        "regime": decision.regime,
        "ensemble_agreement": decision.ensemble_agreement,
        "sentiment_score": decision.sentiment_score,
        "technical_score": decision.technical_score,
        "prediction_score": decision.prediction_score,
        "signals": decision.signals,
        "hold_period_days": decision.hold_period_days,
        "entry_date": decision.entry_date,
        "exit_date": decision.exit_date,
        "timestamp": datetime.utcnow().isoformat(),
    })


@router.get("/bulk-signals")
async def bulk_signals(
    market: str = Query("US"),
    limit: int = Query(10, le=20),
):
    """Get AI signals for top symbols in a market"""
    from app.services.market_data import get_symbols_for_market
    symbols_info = get_symbols_for_market(market)[:limit]

    agent = get_trading_agent()
    signals = []

    for info in symbols_info:
        symbol = info["symbol"]
        try:
            df = await fetch_history(symbol, period="1mo", interval="1d")
            news = await fetch_symbol_news(symbol, limit=5)

            if df is not None and not df.empty:
                decision = agent.analyze(symbol, market, df, news)
                # Use live feed price — decision.current_price is from historical df (stale)
                live_q = live_feed.get_quote(symbol)
                live_p = live_q["price"] if live_q else decision.current_price
                signals.append({
                    "symbol": symbol,
                    "name": info.get("name", symbol),
                    "action": decision.action,
                    "confidence": decision.confidence,
                    "current_price": live_p,
                    "predicted_price": decision.predicted_price,
                    "expected_return_pct": decision.expected_return_pct,
                    "sentiment_score": decision.sentiment_score,
                    "technical_score": decision.technical_score,
                })
        except Exception as e:
            logger.warning(f"Signal error for {symbol}: {e}")

    # Sort by confidence
    signals.sort(key=lambda x: x["confidence"], reverse=True)
    return signals


@router.get("/market-sentiment")
async def market_sentiment():
    """Get overall market sentiment from global news"""
    return await get_market_sentiment_summary()


@router.get("/technical/{symbol}")
async def technical_analysis(symbol: str):
    """Get detailed technical analysis for a symbol"""
    df = await fetch_history(symbol, period="3mo", interval="1d")
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")

    analyzer = get_technical_analyzer()
    signal = analyzer.analyze(df)

    return {
        "symbol": symbol,
        "action": signal.action,
        "score": signal.score,
        "confidence": signal.confidence,
        "rsi": signal.rsi,
        "macd_signal": signal.macd_signal,
        "bb_signal": signal.bb_signal,
        "ema_signal": signal.ema_signal,
        "volume_signal": signal.volume_signal,
        "support": signal.support,
        "resistance": signal.resistance,
        "indicators": signal.indicators,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/top-opportunities")
async def top_opportunities():
    """Get top trading opportunities across all markets"""
    from app.services.market_data import ALL_SYMBOLS
    agent = get_trading_agent()
    opportunities = []

    # Sample key symbols from each market
    target_symbols = {
        "US": ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN"],
        "INDIA": ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS"],
        "CRYPTO": ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD"],
    }

    for market, symbols in target_symbols.items():
        for symbol in symbols:
            try:
                df = await fetch_history(symbol, period="1mo", interval="1d")
                news = await fetch_symbol_news(symbol, limit=5)
                if df is not None and not df.empty:
                    decision = agent.analyze(symbol, market, df, news)
                    if decision.action in ("BUY", "SELL") and decision.confidence >= 0.6:
                        live_q = live_feed.get_quote(symbol)
                        live_p = live_q["price"] if live_q else decision.current_price
                        opportunities.append({
                            "symbol": symbol,
                            "market": market,
                            "action": decision.action,
                            "confidence": decision.confidence,
                            "current_price": live_p,
                            "target_price": decision.target_price,
                            "stop_loss": decision.stop_loss,
                            "expected_return_pct": decision.expected_return_pct,
                            "risk_reward_ratio": decision.risk_reward_ratio,
                            "reasoning": decision.reasoning,
                        })
            except Exception as e:
                logger.warning(f"Opportunity analysis failed for {symbol}: {e}")

    opportunities.sort(key=lambda x: x["confidence"] * abs(x["expected_return_pct"]), reverse=True)
    return opportunities[:10]
