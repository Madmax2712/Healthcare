"""
Market Regime Detector
Classifies the current market state: BULL_TRENDING, BEAR_TRENDING,
RANGING, HIGH_VOLATILITY, or RECOVERY.
Signals are filtered by regime — only compatible signals are passed through.
"""
import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class RegimeResult:
    regime: str          # BULL_TRENDING | BEAR_TRENDING | RANGING | HIGH_VOLATILITY | RECOVERY
    strength: float      # 0-1 how strong/clear the regime is
    trend_score: float   # -1 to 1
    volatility_pct: float
    signal_filter: str   # BUY_ALLOWED | SELL_ALLOWED | BOTH_ALLOWED | NO_TRADE
    description: str


REGIME_DESCRIPTIONS = {
    "BULL_TRENDING":   "Strong uptrend — prefer BUY signals, avoid shorts",
    "BEAR_TRENDING":   "Strong downtrend — prefer SELL signals, avoid longs",
    "RANGING":         "Sideways consolidation — trade reversals at support/resistance",
    "HIGH_VOLATILITY": "Extreme volatility — reduce position sizes, higher risk",
    "RECOVERY":        "Recovering from dip — early BUY opportunities with caution",
}


class MarketRegimeDetector:
    def detect(self, df: pd.DataFrame) -> RegimeResult:
        """
        Detect market regime from price data.
        Uses multiple methods: trend, volatility, and momentum regime.
        """
        if df is None or len(df) < 50:
            return RegimeResult(
                regime="RANGING",
                strength=0.3,
                trend_score=0.0,
                volatility_pct=0.0,
                signal_filter="BOTH_ALLOWED",
                description="Insufficient data for regime detection",
            )

        close = df["close"]
        returns = close.pct_change().dropna()

        # ── Trend detection ──────────────────────────────────────────────
        sma20 = close.rolling(20).mean().iloc[-1]
        sma50 = close.rolling(50).mean().iloc[-1]
        sma200 = close.rolling(200).mean().iloc[-1] if len(close) >= 200 else sma50
        current = close.iloc[-1]

        # Score: how many MAs is price above/below?
        trend_votes = []
        for ma in [sma20, sma50, sma200]:
            if ma and ma > 0:
                trend_votes.append(1 if current > ma else -1)

        # Linear slope over 20 bars
        x = np.arange(20)
        recent = close.tail(20).values
        slope = np.polyfit(x, recent, 1)[0] / (recent.mean() + 1e-10)
        trend_votes.append(np.sign(slope) * min(1.0, abs(slope) * 50))

        trend_score = float(np.mean(trend_votes))

        # ── Volatility regime ────────────────────────────────────────────
        vol_5d = returns.tail(5).std() * np.sqrt(252) * 100
        vol_20d = returns.tail(20).std() * np.sqrt(252) * 100
        vol_50d = returns.tail(50).std() * np.sqrt(252) * 100 if len(returns) >= 50 else vol_20d
        vol_ratio = vol_5d / (vol_50d + 1e-10)   # >1.5 = elevated vol

        # ── Momentum regime ──────────────────────────────────────────────
        ret_5d  = (current / close.iloc[-6]  - 1) if len(close) > 5 else 0
        ret_20d = (current / close.iloc[-21] - 1) if len(close) > 20 else 0
        ret_50d = (current / close.iloc[-51] - 1) if len(close) > 50 else ret_20d

        # ── Regime classification ────────────────────────────────────────
        is_high_vol = vol_ratio > 1.8 or vol_5d > 60

        if is_high_vol:
            regime = "HIGH_VOLATILITY"
            signal_filter = "BOTH_ALLOWED"
            strength = min(1.0, vol_ratio / 3)

        elif trend_score >= 0.5 and ret_20d >= 0.02:
            # Strong uptrend
            if ret_5d < -0.03 and ret_20d > 0.05:
                regime = "RECOVERY"
                signal_filter = "BUY_ALLOWED"
                strength = min(1.0, abs(trend_score) * 0.8)
            else:
                regime = "BULL_TRENDING"
                signal_filter = "BUY_ALLOWED"
                strength = min(1.0, abs(trend_score))

        elif trend_score <= -0.5 and ret_20d <= -0.02:
            regime = "BEAR_TRENDING"
            signal_filter = "SELL_ALLOWED"
            strength = min(1.0, abs(trend_score))

        else:
            regime = "RANGING"
            signal_filter = "BOTH_ALLOWED"
            # Strength inversely proportional to trend clarity
            strength = max(0.1, 1.0 - abs(trend_score) * 1.5)

        description = REGIME_DESCRIPTIONS.get(regime, "")

        return RegimeResult(
            regime=regime,
            strength=round(strength, 4),
            trend_score=round(trend_score, 4),
            volatility_pct=round(vol_5d, 2),
            signal_filter=signal_filter,
            description=description,
        )

    def is_signal_allowed(self, regime: RegimeResult, action: str) -> bool:
        """Check if a trade action is compatible with the current regime"""
        if action == "HOLD":
            return True
        if regime.signal_filter == "BOTH_ALLOWED":
            return True
        if action == "BUY" and regime.signal_filter in ("BUY_ALLOWED", "BOTH_ALLOWED"):
            return True
        if action == "SELL" and regime.signal_filter in ("SELL_ALLOWED", "BOTH_ALLOWED"):
            return True
        return False

    def get_position_size_multiplier(self, regime: RegimeResult) -> float:
        """
        Scale position size based on regime:
        - Strong clear trend: full size
        - Ranging: 70%
        - High volatility: 40%
        """
        if regime.regime in ("BULL_TRENDING", "BEAR_TRENDING"):
            return min(1.0, 0.6 + regime.strength * 0.4)
        elif regime.regime == "RECOVERY":
            return 0.7
        elif regime.regime == "HIGH_VOLATILITY":
            return 0.4
        else:
            return 0.6


_regime_detector: Optional[MarketRegimeDetector] = None


def get_regime_detector() -> MarketRegimeDetector:
    global _regime_detector
    if _regime_detector is None:
        _regime_detector = MarketRegimeDetector()
    return _regime_detector
