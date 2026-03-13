"""
Technical Analysis Engine
Computes RSI, MACD, Bollinger Bands, EMA, Volume signals
"""
import pandas as pd
import numpy as np
from typing import Dict, Optional, Tuple
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class TechnicalSignal:
    action: str           # BUY, SELL, HOLD
    score: float          # -1.0 to 1.0
    confidence: float     # 0.0 to 1.0
    rsi: float
    macd_signal: str      # BULLISH, BEARISH, NEUTRAL
    bb_signal: str        # OVERSOLD, OVERBOUGHT, NEUTRAL
    ema_signal: str       # BULLISH, BEARISH, NEUTRAL
    volume_signal: str    # HIGH, LOW, NORMAL
    support: float
    resistance: float
    indicators: Dict


def compute_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    delta = prices.diff()
    gain = delta.where(delta > 0, 0).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / (loss + 1e-10)
    return 100 - (100 / (1 + rs))


def compute_macd(prices: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> Tuple[pd.Series, pd.Series, pd.Series]:
    ema_fast = prices.ewm(span=fast, adjust=False).mean()
    ema_slow = prices.ewm(span=slow, adjust=False).mean()
    macd = ema_fast - ema_slow
    signal_line = macd.ewm(span=signal, adjust=False).mean()
    histogram = macd - signal_line
    return macd, signal_line, histogram


def compute_bollinger_bands(prices: pd.Series, period: int = 20, std_dev: float = 2.0) -> Tuple[pd.Series, pd.Series, pd.Series]:
    sma = prices.rolling(window=period).mean()
    std = prices.rolling(window=period).std()
    upper = sma + (std * std_dev)
    lower = sma - (std * std_dev)
    return upper, sma, lower


def compute_ema(prices: pd.Series, short: int = 9, long: int = 21) -> Tuple[pd.Series, pd.Series]:
    ema_short = prices.ewm(span=short, adjust=False).mean()
    ema_long = prices.ewm(span=long, adjust=False).mean()
    return ema_short, ema_long


class TechnicalAnalyzer:
    def analyze(self, df: pd.DataFrame) -> TechnicalSignal:
        """
        Analyze price/volume data and return trading signal.
        df must have columns: ['open', 'high', 'low', 'close', 'volume']
        """
        if df is None or len(df) < 30:
            return TechnicalSignal(
                action="HOLD", score=0.0, confidence=0.3,
                rsi=50.0, macd_signal="NEUTRAL", bb_signal="NEUTRAL",
                ema_signal="NEUTRAL", volume_signal="NORMAL",
                support=0.0, resistance=0.0, indicators={}
            )

        close = df["close"]
        volume = df["volume"] if "volume" in df.columns else pd.Series([1] * len(df))

        signals = []
        scores = []

        # RSI Analysis
        rsi = compute_rsi(close)
        rsi_current = rsi.iloc[-1]
        if rsi_current < 30:
            signals.append(("RSI", "BUY", 0.8))
            scores.append(0.7)
        elif rsi_current < 40:
            signals.append(("RSI", "BUY", 0.5))
            scores.append(0.3)
        elif rsi_current > 70:
            signals.append(("RSI", "SELL", 0.8))
            scores.append(-0.7)
        elif rsi_current > 60:
            signals.append(("RSI", "SELL", 0.5))
            scores.append(-0.3)
        else:
            signals.append(("RSI", "HOLD", 0.3))
            scores.append(0.0)

        # MACD Analysis
        macd, signal_line, histogram = compute_macd(close)
        macd_current = macd.iloc[-1]
        signal_current = signal_line.iloc[-1]
        hist_current = histogram.iloc[-1]
        hist_prev = histogram.iloc[-2] if len(histogram) > 1 else 0

        if macd_current > signal_current and hist_current > 0 and hist_current > hist_prev:
            macd_signal = "BULLISH"
            scores.append(0.5)
        elif macd_current < signal_current and hist_current < 0 and hist_current < hist_prev:
            macd_signal = "BEARISH"
            scores.append(-0.5)
        else:
            macd_signal = "NEUTRAL"
            scores.append(0.0)

        # Bollinger Bands
        bb_upper, bb_mid, bb_lower = compute_bollinger_bands(close)
        current_price = close.iloc[-1]
        bb_upper_val = bb_upper.iloc[-1]
        bb_lower_val = bb_lower.iloc[-1]
        bb_mid_val = bb_mid.iloc[-1]

        if current_price <= bb_lower_val:
            bb_signal = "OVERSOLD"
            scores.append(0.6)
        elif current_price >= bb_upper_val:
            bb_signal = "OVERBOUGHT"
            scores.append(-0.6)
        else:
            bb_position = (current_price - bb_lower_val) / (bb_upper_val - bb_lower_val + 1e-10)
            bb_signal = "NEUTRAL"
            scores.append((0.5 - bb_position) * 0.4)

        # EMA Crossover
        ema_short, ema_long = compute_ema(close)
        ema_short_current = ema_short.iloc[-1]
        ema_long_current = ema_long.iloc[-1]
        ema_short_prev = ema_short.iloc[-2] if len(ema_short) > 1 else ema_short_current
        ema_long_prev = ema_long.iloc[-2] if len(ema_long) > 1 else ema_long_current

        if ema_short_current > ema_long_current and ema_short_prev <= ema_long_prev:
            ema_signal = "BULLISH"
            scores.append(0.7)
        elif ema_short_current < ema_long_current and ema_short_prev >= ema_long_prev:
            ema_signal = "BEARISH"
            scores.append(-0.7)
        elif ema_short_current > ema_long_current:
            ema_signal = "BULLISH"
            scores.append(0.3)
        else:
            ema_signal = "BEARISH"
            scores.append(-0.3)

        # Volume Analysis
        avg_volume = volume.rolling(20).mean().iloc[-1]
        current_volume = volume.iloc[-1]
        if avg_volume > 0:
            vol_ratio = current_volume / avg_volume
            if vol_ratio > 1.5:
                volume_signal = "HIGH"
                # High volume confirms direction
                direction_score = sum(scores) / len(scores) if scores else 0
                scores.append(0.2 * np.sign(direction_score))
            elif vol_ratio < 0.5:
                volume_signal = "LOW"
                scores.append(0.0)
            else:
                volume_signal = "NORMAL"
                scores.append(0.0)
        else:
            volume_signal = "NORMAL"

        # Support and Resistance (simple pivot points)
        recent = df.tail(20)
        support = float(recent["low"].min())
        resistance = float(recent["high"].max())

        # Aggregate score
        final_score = sum(scores) / len(scores) if scores else 0.0
        final_score = max(-1.0, min(1.0, final_score))

        # Determine action
        if final_score >= 0.3:
            action = "BUY"
        elif final_score <= -0.3:
            action = "SELL"
        else:
            action = "HOLD"

        confidence = min(1.0, abs(final_score) * 1.2 + 0.2)

        return TechnicalSignal(
            action=action,
            score=round(final_score, 4),
            confidence=round(confidence, 4),
            rsi=round(float(rsi_current), 2),
            macd_signal=macd_signal,
            bb_signal=bb_signal,
            ema_signal=ema_signal,
            volume_signal=volume_signal,
            support=round(support, 4),
            resistance=round(resistance, 4),
            indicators={
                "rsi": round(float(rsi_current), 2),
                "macd": round(float(macd_current), 4),
                "macd_signal": round(float(signal_current), 4),
                "bb_upper": round(float(bb_upper_val), 4),
                "bb_lower": round(float(bb_lower_val), 4),
                "bb_mid": round(float(bb_mid_val), 4),
                "ema_short": round(float(ema_short_current), 4),
                "ema_long": round(float(ema_long_current), 4),
            }
        )


_technical_analyzer: Optional[TechnicalAnalyzer] = None


def get_technical_analyzer() -> TechnicalAnalyzer:
    global _technical_analyzer
    if _technical_analyzer is None:
        _technical_analyzer = TechnicalAnalyzer()
    return _technical_analyzer
