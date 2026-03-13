"""
Ensemble Prediction Model
Combines multiple independent predictors and only accepts signals
when a supermajority agree. This is the core accuracy mechanism.

Strategy: "When in doubt, don't trade"
- 5 independent sub-models vote
- Signal passes only with 4/5 or 5/5 agreement (80-100%)
- Each model uses completely different logic to avoid correlated errors
"""
import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class ModelVote:
    model_name: str
    action: str      # BUY | SELL | HOLD
    score: float     # -1.0 to 1.0
    confidence: float


@dataclass
class EnsembleResult:
    final_action: str
    ensemble_confidence: float    # 0-1
    vote_agreement: float         # fraction of models agreeing
    buy_votes: int
    sell_votes: int
    hold_votes: int
    individual_votes: List[ModelVote]
    is_high_confidence: bool      # True only when ≥4/5 models agree strongly
    reasoning: str


class MomentumModel:
    """Price momentum and mean-reversion predictor"""
    name = "momentum"

    def predict(self, df: pd.DataFrame) -> ModelVote:
        close = df["close"]
        if len(close) < 21:
            return ModelVote(self.name, "HOLD", 0.0, 0.3)

        ret_5d  = close.iloc[-1] / close.iloc[-6]  - 1
        ret_10d = close.iloc[-1] / close.iloc[-11] - 1
        ret_21d = close.iloc[-1] / close.iloc[-22] - 1

        # Mean reversion component
        mean_20 = close.tail(20).mean()
        dev = (close.iloc[-1] - mean_20) / (mean_20 + 1e-10)

        # Score: blend momentum with mean reversion
        score = (
            ret_5d  * 2.0 +
            ret_10d * 1.0 +
            ret_21d * 0.5 +
            (-dev)  * 0.8   # mean reversion: if too far up, expect pullback
        ) * 5.0  # scale

        score = max(-1.0, min(1.0, score))
        conf = min(0.85, abs(score) * 0.7 + 0.25)

        if score >= 0.25:
            action = "BUY"
        elif score <= -0.25:
            action = "SELL"
        else:
            action = "HOLD"

        return ModelVote(self.name, action, round(score, 4), round(conf, 4))


class TrendFollowingModel:
    """EMA-based trend following — classic trend rider"""
    name = "trend_follow"

    def predict(self, df: pd.DataFrame) -> ModelVote:
        close = df["close"]
        if len(close) < 51:
            return ModelVote(self.name, "HOLD", 0.0, 0.3)

        ema9  = close.ewm(span=9,  adjust=False).mean().iloc[-1]
        ema21 = close.ewm(span=21, adjust=False).mean().iloc[-1]
        ema50 = close.ewm(span=50, adjust=False).mean().iloc[-1]
        price = close.iloc[-1]

        votes = []
        if price > ema9:  votes.append(0.4)
        else:             votes.append(-0.4)
        if ema9 > ema21:  votes.append(0.3)
        else:             votes.append(-0.3)
        if ema21 > ema50: votes.append(0.3)
        else:             votes.append(-0.3)

        # Slope confirmation
        slope_5 = (close.tail(5).values[-1] - close.tail(5).values[0]) / (close.tail(5).values[0] + 1e-10)
        votes.append(np.clip(slope_5 * 20, -0.3, 0.3))

        score = sum(votes)
        score = max(-1.0, min(1.0, score))
        conf = min(0.88, abs(score) * 0.8 + 0.2)

        if score >= 0.4:
            action = "BUY"
        elif score <= -0.4:
            action = "SELL"
        else:
            action = "HOLD"

        return ModelVote(self.name, action, round(score, 4), round(conf, 4))


class OscillatorModel:
    """RSI + Stochastic oscillator combination"""
    name = "oscillator"

    def predict(self, df: pd.DataFrame) -> ModelVote:
        close = df["close"]
        high  = df["high"]
        low   = df["low"]
        if len(close) < 15:
            return ModelVote(self.name, "HOLD", 0.0, 0.3)

        # RSI
        delta = close.diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / (loss + 1e-10)
        rsi = (100 - 100 / (1 + rs)).iloc[-1]

        # Stochastic
        low14  = low.rolling(14).min().iloc[-1]
        high14 = high.rolling(14).max().iloc[-1]
        stoch_k = (close.iloc[-1] - low14) / (high14 - low14 + 1e-10) * 100

        # Williams %R
        will_r = -100 * (high14 - close.iloc[-1]) / (high14 - low14 + 1e-10)

        # Score each
        rsi_score = (50 - rsi) / 50 * -1   # oversold=positive, overbought=negative
        stoch_score = (50 - stoch_k) / 50 * -1
        will_score = (will_r + 50) / 50

        score = (rsi_score * 0.5 + stoch_score * 0.3 + will_score * 0.2)
        score = max(-1.0, min(1.0, score))

        # Oscillators are strongest at extremes
        conf = min(0.90, abs(score) * 1.1 + 0.15)

        if score >= 0.30:
            action = "BUY"
        elif score <= -0.30:
            action = "SELL"
        else:
            action = "HOLD"

        return ModelVote(self.name, action, round(score, 4), round(conf, 4))


class VolumeProfileModel:
    """Volume-weighted price analysis"""
    name = "volume_profile"

    def predict(self, df: pd.DataFrame) -> ModelVote:
        close = df["close"]
        volume = df.get("volume", pd.Series(np.ones(len(df)), index=df.index))
        if len(close) < 20:
            return ModelVote(self.name, "HOLD", 0.0, 0.3)

        # VWAP deviation
        typical = (df["high"] + df["low"] + close) / 3
        vwap_20 = (typical * volume).rolling(20).sum() / (volume.rolling(20).sum() + 1e-10)
        vwap_dev = (close.iloc[-1] - vwap_20.iloc[-1]) / (vwap_20.iloc[-1] + 1e-10)

        # Volume trend
        avg_vol = volume.rolling(20).mean().iloc[-1]
        curr_vol = volume.iloc[-1]
        vol_strength = min(2.0, curr_vol / (avg_vol + 1e-10))

        # OBV trend
        obv = (np.sign(close.diff()) * volume).cumsum()
        obv_slope = (obv.iloc[-1] - obv.iloc[-5]) / (abs(obv.iloc[-5]) + 1e-10)
        obv_slope = np.clip(obv_slope, -0.5, 0.5)

        # When price is below VWAP with high volume: oversold buy signal
        # When price is above VWAP with high volume: momentum confirmation
        if vwap_dev < -0.02:   # below VWAP
            vwap_signal = 0.4 * vol_strength   # bullish mean reversion
        elif vwap_dev > 0.02:  # above VWAP
            vwap_signal = -0.2 * vol_strength  # extended, potential pullback
        else:
            vwap_signal = obv_slope

        score = (vwap_signal * 0.6 + obv_slope * 0.4)
        score = max(-1.0, min(1.0, score))
        conf = min(0.82, abs(score) * 0.7 + 0.20)

        if score >= 0.25:
            action = "BUY"
        elif score <= -0.25:
            action = "SELL"
        else:
            action = "HOLD"

        return ModelVote(self.name, action, round(score, 4), round(conf, 4))


class PatternRecognitionModel:
    """Chart pattern and candlestick pattern detector"""
    name = "pattern"

    def predict(self, df: pd.DataFrame) -> ModelVote:
        close = df["close"]
        high  = df["high"]
        low   = df["low"]
        open_ = df.get("open", close)
        if len(close) < 10:
            return ModelVote(self.name, "HOLD", 0.0, 0.3)

        signals = []

        # Higher highs + higher lows (uptrend structure)
        last5_highs = high.tail(5).values
        last5_lows  = low.tail(5).values
        if all(last5_highs[i] >= last5_highs[i-1] for i in range(1, 5)):
            signals.append(0.4)  # higher highs
        elif all(last5_highs[i] <= last5_highs[i-1] for i in range(1, 5)):
            signals.append(-0.4)

        if all(last5_lows[i] >= last5_lows[i-1] for i in range(1, 5)):
            signals.append(0.3)
        elif all(last5_lows[i] <= last5_lows[i-1] for i in range(1, 5)):
            signals.append(-0.3)

        # Hammer / Shooting star candlestick
        body = abs(close.iloc[-1] - open_.iloc[-1])
        lower_shadow = min(close.iloc[-1], open_.iloc[-1]) - low.iloc[-1]
        upper_shadow = high.iloc[-1] - max(close.iloc[-1], open_.iloc[-1])
        candle_range = high.iloc[-1] - low.iloc[-1] + 1e-10

        if lower_shadow > 2 * body and upper_shadow < 0.3 * candle_range:
            signals.append(0.35)  # Hammer (bullish)
        if upper_shadow > 2 * body and lower_shadow < 0.3 * candle_range:
            signals.append(-0.35)  # Shooting star (bearish)

        # Support bounce / resistance rejection
        support = low.tail(20).min()
        resistance = high.tail(20).max()
        price = close.iloc[-1]
        if abs(price - support) / (price + 1e-10) < 0.02:
            signals.append(0.35)  # Near support = buy
        if abs(price - resistance) / (price + 1e-10) < 0.02:
            signals.append(-0.35)  # Near resistance = sell

        # Breakout
        sma20_high = high.tail(20).quantile(0.90)
        sma20_low  = low.tail(20).quantile(0.10)
        if price > sma20_high * 1.005:
            signals.append(0.4)   # Breakout above resistance
        elif price < sma20_low * 0.995:
            signals.append(-0.4)  # Breakdown below support

        if not signals:
            return ModelVote(self.name, "HOLD", 0.0, 0.35)

        score = max(-1.0, min(1.0, sum(signals) / max(len(signals), 1)))
        conf = min(0.85, abs(score) * 0.9 + 0.15)

        if score >= 0.25:
            action = "BUY"
        elif score <= -0.25:
            action = "SELL"
        else:
            action = "HOLD"

        return ModelVote(self.name, action, round(score, 4), round(conf, 4))


class EnsembleModel:
    """
    5-model ensemble with supermajority voting.
    Only passes signals when ≥4/5 models agree (80%+ consensus).
    This strict consensus is the primary accuracy mechanism.
    """

    CONSENSUS_THRESHOLD = 0.75      # fraction of models that must agree (≥4 of 5)
    MIN_AVG_CONFIDENCE = 0.55       # each model's avg confidence must exceed this

    def __init__(self):
        self.models = [
            MomentumModel(),
            TrendFollowingModel(),
            OscillatorModel(),
            VolumeProfileModel(),
            PatternRecognitionModel(),
        ]

    def predict(self, df: pd.DataFrame) -> EnsembleResult:
        if df is None or len(df) < 20:
            return EnsembleResult(
                final_action="HOLD", ensemble_confidence=0.0,
                vote_agreement=0.0, buy_votes=0, sell_votes=0, hold_votes=5,
                individual_votes=[], is_high_confidence=False,
                reasoning="Insufficient data for ensemble prediction"
            )

        votes: List[ModelVote] = []
        for model in self.models:
            try:
                vote = model.predict(df)
                votes.append(vote)
            except Exception as e:
                logger.warning(f"Model {model.name} failed: {e}")
                votes.append(ModelVote(model.name, "HOLD", 0.0, 0.3))

        buy_votes  = sum(1 for v in votes if v.action == "BUY")
        sell_votes = sum(1 for v in votes if v.action == "SELL")
        hold_votes = sum(1 for v in votes if v.action == "HOLD")
        total = len(votes)

        # Determine dominant action
        if buy_votes >= sell_votes and buy_votes >= hold_votes:
            dominant = "BUY"
            dominant_count = buy_votes
        elif sell_votes >= buy_votes and sell_votes >= hold_votes:
            dominant = "SELL"
            dominant_count = sell_votes
        else:
            dominant = "HOLD"
            dominant_count = hold_votes

        agreement = dominant_count / max(total, 1)

        # Weighted ensemble score (sign matters)
        all_scores = [v.score for v in votes]
        all_confs  = [v.confidence for v in votes]
        weighted_score = sum(s * c for s, c in zip(all_scores, all_confs)) / (sum(all_confs) + 1e-10)
        avg_confidence = sum(all_confs) / max(total, 1)

        # ── Supermajority gate ────────────────────────────────────────────
        # Signal only passes if:
        # 1. ≥75% of models agree (≥4 of 5)
        # 2. Average confidence is meaningful
        # 3. Weighted score strongly supports direction
        is_high_confidence = (
            agreement >= self.CONSENSUS_THRESHOLD and
            avg_confidence >= self.MIN_AVG_CONFIDENCE and
            abs(weighted_score) >= 0.25 and
            dominant != "HOLD"
        )

        if not is_high_confidence:
            final_action = "HOLD"
            ensemble_confidence = avg_confidence * agreement * 0.7
        else:
            final_action = dominant
            # Confidence scales with agreement and score strength
            ensemble_confidence = min(
                0.92,
                agreement * 0.5 + abs(weighted_score) * 0.3 + avg_confidence * 0.2
            )

        # Build reasoning
        model_summary = " | ".join(f"{v.model_name}:{v.action}({v.score:+.2f})" for v in votes)
        reasoning = (
            f"Ensemble [{total} models]: {buy_votes}B/{sell_votes}S/{hold_votes}H "
            f"({agreement:.0%} agree) — {model_summary}"
        )

        return EnsembleResult(
            final_action=final_action,
            ensemble_confidence=round(ensemble_confidence, 4),
            vote_agreement=round(agreement, 4),
            buy_votes=buy_votes,
            sell_votes=sell_votes,
            hold_votes=hold_votes,
            individual_votes=votes,
            is_high_confidence=is_high_confidence,
            reasoning=reasoning,
        )


_ensemble: Optional[EnsembleModel] = None


def get_ensemble_model() -> EnsembleModel:
    global _ensemble
    if _ensemble is None:
        _ensemble = EnsembleModel()
    return _ensemble
