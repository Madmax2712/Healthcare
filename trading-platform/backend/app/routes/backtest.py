"""
Backtesting & Accuracy Metrics API
Validates historical signal accuracy before trusting the live system.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List
import logging

from app.services.market_data import fetch_history
from app.ai.backtester import get_backtester, generate_historical_signals
from app.ai.trading_agent import get_trading_agent

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/backtest", tags=["backtest"])


@router.get("/run/{symbol}")
async def run_backtest(
    symbol: str,
    market: str = Query("US"),
    period: str = Query("6mo", description="Historical lookback: 3mo, 6mo, 1y, 2y"),
):
    """
    Run backtest for a symbol over historical data.
    Returns win rate, profit factor, Sharpe ratio, and full trade log.
    """
    df = await fetch_history(symbol, period=period, interval="1d")
    if df is None or len(df) < 40:
        raise HTTPException(status_code=404, detail=f"Insufficient data for {symbol}")

    agent = get_trading_agent()
    backtester = get_backtester()

    signals = generate_historical_signals(df, agent, symbol, market, lookback=40)
    result = backtester.run(df, signals, symbol=symbol)

    return {
        "symbol": symbol,
        "market": market,
        "period": period,
        "total_trades": result.total_trades,
        "win_rate": result.win_rate,
        "win_rate_pct": f"{result.win_rate * 100:.1f}%",
        "avg_return_pct": result.avg_return_pct,
        "profit_factor": result.profit_factor,
        "sharpe_ratio": result.sharpe_ratio,
        "max_drawdown_pct": result.max_drawdown_pct,
        "total_return_pct": result.total_return_pct,
        "accuracy_by_confidence": result.accuracy_by_confidence,
        "equity_curve": result.equity_curve,
        "summary": result.summary,
        "recent_trades": [
            {
                "entry_date": t.entry_date,
                "exit_date": t.exit_date,
                "action": t.action,
                "entry_price": t.entry_price,
                "exit_price": t.exit_price,
                "return_pct": t.return_pct,
                "is_win": t.is_win,
                "confidence": t.signal_confidence,
                "exit_reason": t.exit_reason,
            }
            for t in result.trades[-20:]  # last 20 trades
        ],
    }


@router.get("/accuracy-report")
async def accuracy_report():
    """
    Run backtests across key symbols and aggregate accuracy metrics.
    Shows the system's historical performance.
    """
    test_symbols = [
        ("AAPL", "US"), ("MSFT", "US"), ("NVDA", "US"),
        ("BTC-USD", "CRYPTO"), ("ETH-USD", "CRYPTO"),
        ("RELIANCE.NS", "INDIA"), ("TCS.NS", "INDIA"),
    ]

    backtester = get_backtester()
    agent = get_trading_agent()
    results = []

    for symbol, market in test_symbols:
        try:
            df = await fetch_history(symbol, period="6mo", interval="1d")
            if df is None or len(df) < 40:
                continue
            signals = generate_historical_signals(df, agent, symbol, market, lookback=40)
            r = backtester.run(df, signals, symbol=symbol)
            if r.total_trades > 0:
                results.append({
                    "symbol": symbol,
                    "market": market,
                    "total_trades": r.total_trades,
                    "win_rate": r.win_rate,
                    "profit_factor": r.profit_factor,
                    "sharpe_ratio": r.sharpe_ratio,
                    "total_return_pct": r.total_return_pct,
                    "max_drawdown_pct": r.max_drawdown_pct,
                })
        except Exception as e:
            logger.warning(f"Backtest failed for {symbol}: {e}")

    if not results:
        return {"message": "No backtest results — insufficient historical data", "results": []}

    import numpy as np
    avg_win_rate = float(np.mean([r["win_rate"] for r in results]))
    avg_pf = float(np.mean([r["profit_factor"] for r in results]))
    avg_sharpe = float(np.mean([r["sharpe_ratio"] for r in results]))
    total_trades = sum(r["total_trades"] for r in results)

    return {
        "summary": {
            "symbols_tested": len(results),
            "total_trades": total_trades,
            "avg_win_rate": round(avg_win_rate, 4),
            "avg_win_rate_pct": f"{avg_win_rate * 100:.1f}%",
            "avg_profit_factor": round(avg_pf, 3),
            "avg_sharpe_ratio": round(avg_sharpe, 3),
            "note": (
                "Win rate is driven by selectivity — the system only trades when "
                "5+ of 7 signal layers agree. Fewer trades, higher accuracy."
            ),
        },
        "by_symbol": results,
    }
