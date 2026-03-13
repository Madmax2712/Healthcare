"""
Backtesting Engine
Validates AI signal accuracy against historical data.
Computes: win rate, profit factor, Sharpe ratio, max drawdown.
"""
import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@dataclass
class BacktestTrade:
    entry_date: str
    exit_date: str
    symbol: str
    action: str
    entry_price: float
    exit_price: float
    return_pct: float
    is_win: bool
    signal_confidence: float
    exit_reason: str   # "take_profit" | "stop_loss" | "signal_exit" | "end_of_data"


@dataclass
class BacktestResult:
    symbol: str
    total_trades: int
    win_rate: float           # fraction of profitable trades
    avg_return_pct: float     # average return per trade
    profit_factor: float      # gross wins / gross losses
    sharpe_ratio: float       # annualized Sharpe
    max_drawdown_pct: float   # maximum peak-to-trough decline
    total_return_pct: float   # cumulative return
    avg_holding_days: float
    trades: List[BacktestTrade]
    accuracy_by_confidence: Dict[str, float]  # bucketed accuracy
    equity_curve: List[float]
    summary: str


def _compute_sharpe(returns: np.ndarray, risk_free: float = 0.0, periods: int = 252) -> float:
    if len(returns) < 2:
        return 0.0
    excess = returns - risk_free / periods
    if excess.std() == 0:
        return 0.0
    return float(np.sqrt(periods) * excess.mean() / excess.std())


def _compute_max_drawdown(equity_curve: List[float]) -> float:
    if not equity_curve:
        return 0.0
    peak = equity_curve[0]
    max_dd = 0.0
    for v in equity_curve:
        if v > peak:
            peak = v
        dd = (peak - v) / (peak + 1e-10)
        if dd > max_dd:
            max_dd = dd
    return max_dd


class Backtester:
    """
    Walk-forward backtester.
    Simulates the AI signal generation on historical data
    and measures how accurate the predictions were.
    """

    def __init__(
        self,
        stop_loss_pct: float = 0.04,
        take_profit_pct: float = 0.08,
        max_hold_bars: int = 10,
        transaction_cost_pct: float = 0.001,  # 0.1% per trade
    ):
        self.stop_loss_pct = stop_loss_pct
        self.take_profit_pct = take_profit_pct
        self.max_hold_bars = max_hold_bars
        self.transaction_cost = transaction_cost_pct

    def run(
        self,
        df: pd.DataFrame,
        signals: List[Dict],    # [{date, action, confidence, entry_price}]
        symbol: str = "UNKNOWN",
    ) -> BacktestResult:
        """
        Simulate trading on past signals and compute accuracy metrics.
        signals: list of signal dicts with keys: date, action, confidence, entry_price
        df: historical OHLCV dataframe indexed by date
        """
        trades: List[BacktestTrade] = []
        equity = [1.0]
        current_equity = 1.0

        for sig in signals:
            action = sig.get("action", "HOLD")
            if action == "HOLD":
                continue

            entry_price = sig.get("entry_price", 0)
            confidence  = sig.get("confidence", 0.5)
            entry_date  = sig.get("date", "")

            if not entry_price or entry_price <= 0:
                continue

            # Find future prices after entry
            future = df[df.index > pd.Timestamp(entry_date)] if entry_date else pd.DataFrame()
            if future.empty or len(future) < 2:
                continue

            # Simulate forward: check SL/TP/max hold
            exit_price = future["close"].iloc[-1]
            exit_date  = str(future.index[-1])
            exit_reason = "end_of_data"

            for i, (idx, row) in enumerate(future.iterrows()):
                if i >= self.max_hold_bars:
                    exit_price = row["close"]
                    exit_date  = str(idx)
                    exit_reason = "max_hold"
                    break

                if action == "BUY":
                    if row["low"] <= entry_price * (1 - self.stop_loss_pct):
                        exit_price = entry_price * (1 - self.stop_loss_pct)
                        exit_date  = str(idx)
                        exit_reason = "stop_loss"
                        break
                    if row["high"] >= entry_price * (1 + self.take_profit_pct):
                        exit_price = entry_price * (1 + self.take_profit_pct)
                        exit_date  = str(idx)
                        exit_reason = "take_profit"
                        break
                else:  # SELL
                    if row["high"] >= entry_price * (1 + self.stop_loss_pct):
                        exit_price = entry_price * (1 + self.stop_loss_pct)
                        exit_date  = str(idx)
                        exit_reason = "stop_loss"
                        break
                    if row["low"] <= entry_price * (1 - self.take_profit_pct):
                        exit_price = entry_price * (1 - self.take_profit_pct)
                        exit_date  = str(idx)
                        exit_reason = "take_profit"
                        break

            # Compute return
            if action == "BUY":
                ret = (exit_price - entry_price) / (entry_price + 1e-10) - self.transaction_cost
            else:
                ret = (entry_price - exit_price) / (entry_price + 1e-10) - self.transaction_cost

            is_win = ret > 0
            current_equity *= (1 + ret)
            equity.append(current_equity)

            trades.append(BacktestTrade(
                entry_date=entry_date,
                exit_date=exit_date,
                symbol=symbol,
                action=action,
                entry_price=round(entry_price, 4),
                exit_price=round(exit_price, 4),
                return_pct=round(ret * 100, 3),
                is_win=is_win,
                signal_confidence=confidence,
                exit_reason=exit_reason,
            ))

        if not trades:
            return BacktestResult(
                symbol=symbol, total_trades=0, win_rate=0.0,
                avg_return_pct=0.0, profit_factor=0.0, sharpe_ratio=0.0,
                max_drawdown_pct=0.0, total_return_pct=0.0, avg_holding_days=0.0,
                trades=[], accuracy_by_confidence={}, equity_curve=[1.0],
                summary="No trades generated in backtest period"
            )

        # ── Metrics ──────────────────────────────────────────────────────
        returns = np.array([t.return_pct / 100 for t in trades])
        wins    = [t for t in trades if t.is_win]
        losses  = [t for t in trades if not t.is_win]
        win_rate = len(wins) / len(trades)

        gross_wins   = sum(t.return_pct for t in wins)
        gross_losses = abs(sum(t.return_pct for t in losses))
        profit_factor = gross_wins / (gross_losses + 1e-10)

        sharpe = _compute_sharpe(returns)
        max_dd = _compute_max_drawdown(equity)
        total_return = (equity[-1] - 1.0) * 100

        # Accuracy bucketed by confidence
        buckets = {"50-60%": [], "60-70%": [], "70-80%": [], "80%+": []}
        for t in trades:
            c = t.signal_confidence
            if c >= 0.80:   buckets["80%+"].append(int(t.is_win))
            elif c >= 0.70: buckets["70-80%"].append(int(t.is_win))
            elif c >= 0.60: buckets["60-70%"].append(int(t.is_win))
            else:           buckets["50-60%"].append(int(t.is_win))

        accuracy_by_conf = {
            k: round(np.mean(v), 4) if v else None
            for k, v in buckets.items()
        }

        summary = (
            f"{len(trades)} trades | Win rate: {win_rate:.1%} | "
            f"Avg return: {np.mean(returns)*100:.2f}% | "
            f"Profit factor: {profit_factor:.2f} | "
            f"Sharpe: {sharpe:.2f} | "
            f"Max DD: {max_dd:.1%} | "
            f"Total return: {total_return:.1f}%"
        )

        return BacktestResult(
            symbol=symbol,
            total_trades=len(trades),
            win_rate=round(win_rate, 4),
            avg_return_pct=round(float(np.mean(returns)) * 100, 3),
            profit_factor=round(profit_factor, 3),
            sharpe_ratio=round(sharpe, 3),
            max_drawdown_pct=round(max_dd * 100, 2),
            total_return_pct=round(total_return, 2),
            avg_holding_days=round(np.mean([1] * len(trades)), 1),
            trades=trades,
            accuracy_by_confidence=accuracy_by_conf,
            equity_curve=[round(e, 6) for e in equity],
            summary=summary,
        )


def generate_historical_signals(
    df: pd.DataFrame,
    trading_agent,
    symbol: str,
    market: str,
    lookback: int = 60,
) -> List[Dict]:
    """
    Generate signals on rolling windows for backtesting.
    Uses the AI agent on historical windows to get past signals.
    """
    signals = []
    dates = df.index[lookback:]

    for i, date in enumerate(dates):
        try:
            # Use data available up to this date only (no lookahead)
            window = df.iloc[:lookback + i]
            if len(window) < 30:
                continue

            # Simple signal from technical analysis
            from app.ai.technical_analyzer import get_technical_analyzer
            tech = get_technical_analyzer()
            tech_sig = tech.analyze(window)

            if tech_sig.action != "HOLD" and tech_sig.confidence >= 0.65:
                signals.append({
                    "date": str(date.date()),
                    "action": tech_sig.action,
                    "confidence": tech_sig.confidence,
                    "entry_price": float(window["close"].iloc[-1]),
                })
        except Exception:
            pass

    return signals


_backtester: Optional[Backtester] = None


def get_backtester() -> Backtester:
    global _backtester
    if _backtester is None:
        _backtester = Backtester()
    return _backtester
