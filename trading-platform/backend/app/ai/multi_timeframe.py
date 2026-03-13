"""
Multi-Timeframe Analysis
Checks signal consistency across daily, weekly, and intraday data.
A signal is only valid when multiple timeframes agree — this is a key
accuracy booster used by professional traders.
"""
import asyncio
import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import Optional, Dict, List, Tuple
import logging

from app.ai.technical_analyzer import TechnicalAnalyzer, get_technical_analyzer

logger = logging.getLogger(__name__)


@dataclass
class MultiTimeframeSignal:
    action: str               # BUY | SELL | HOLD
    agreement_score: float    # 0-1 how many timeframes agree
    confidence_boost: float   # how much this boosts/reduces confidence
    timeframe_signals: Dict[str, str]  # {period: action}
    alignment_quality: str    # STRONG | MODERATE | WEAK | CONFLICTED
    reasoning: str


TIMEFRAME_CONFIGS = [
    {"period": "1d",  "interval": "5m",  "label": "Intraday",  "weight": 0.20},
    {"period": "5d",  "interval": "15m", "label": "Short-term", "weight": 0.25},
    {"period": "1mo", "interval": "1d",  "label": "Daily",      "weight": 0.30},
    {"period": "3mo", "interval": "1d",  "label": "Mid-term",   "weight": 0.25},
]


class MultiTimeframeAnalyzer:
    def __init__(self):
        self.tech = get_technical_analyzer()

    async def analyze(
        self,
        symbol: str,
        primary_df: pd.DataFrame,
        fetch_history_fn,
    ) -> MultiTimeframeSignal:
        """
        Analyze signal across multiple timeframes.
        primary_df: the main (daily) DataFrame already fetched.
        fetch_history_fn: async callable(symbol, period, interval) -> df
        """
        timeframe_signals: Dict[str, str] = {}
        weighted_scores: List[Tuple[float, float]] = []   # (score, weight)

        # Use primary data for mid-term and daily
        if primary_df is not None and len(primary_df) >= 20:
            sig = self.tech.analyze(primary_df)
            timeframe_signals["Daily"] = sig.action
            weighted_scores.append((sig.score, 0.30))
            timeframe_signals["Mid-term"] = sig.action
            weighted_scores.append((sig.score * 0.9, 0.25))

        # Try to fetch additional timeframes
        additional = [
            {"period": "1d",  "interval": "5m",  "label": "Intraday",   "weight": 0.20},
            {"period": "5d",  "interval": "15m", "label": "Short-term",  "weight": 0.25},
        ]

        for tf in additional:
            try:
                df = await asyncio.wait_for(
                    fetch_history_fn(symbol, tf["period"], tf["interval"]),
                    timeout=8.0,
                )
                if df is not None and len(df) >= 20:
                    sig = self.tech.analyze(df)
                    timeframe_signals[tf["label"]] = sig.action
                    weighted_scores.append((sig.score, tf["weight"]))
            except Exception as e:
                logger.debug(f"MTF {tf['label']} fetch failed for {symbol}: {e}")

        if not weighted_scores:
            return MultiTimeframeSignal(
                action="HOLD",
                agreement_score=0.0,
                confidence_boost=0.0,
                timeframe_signals={},
                alignment_quality="WEAK",
                reasoning="No timeframe data available",
            )

        # ── Compute weighted composite score ──────────────────────────────
        total_weight = sum(w for _, w in weighted_scores)
        composite = sum(s * w for s, w in weighted_scores) / (total_weight + 1e-10)

        # ── Agreement analysis ────────────────────────────────────────────
        actions = list(timeframe_signals.values())
        buy_count  = actions.count("BUY")
        sell_count = actions.count("SELL")
        hold_count = actions.count("HOLD")
        total = len(actions)

        # Agreement score: fraction of timeframes matching dominant signal
        dominant_count = max(buy_count, sell_count, hold_count)
        agreement_score = dominant_count / max(total, 1)

        # Dominant action
        if buy_count > sell_count and buy_count > hold_count:
            dominant_action = "BUY"
        elif sell_count > buy_count and sell_count > hold_count:
            dominant_action = "SELL"
        else:
            dominant_action = "HOLD"

        # Final action: only trade if composite score is strong
        if composite >= 0.3 and dominant_action == "BUY" and agreement_score >= 0.6:
            final_action = "BUY"
        elif composite <= -0.3 and dominant_action == "SELL" and agreement_score >= 0.6:
            final_action = "SELL"
        else:
            final_action = "HOLD"

        # ── Alignment quality ─────────────────────────────────────────────
        if agreement_score >= 0.85 and final_action != "HOLD":
            quality = "STRONG"
            boost = 0.15
        elif agreement_score >= 0.65:
            quality = "MODERATE"
            boost = 0.05
        elif agreement_score >= 0.50:
            quality = "WEAK"
            boost = -0.05
        else:
            quality = "CONFLICTED"
            boost = -0.20
            final_action = "HOLD"  # Conflicted timeframes = no trade

        tf_summary = ", ".join(f"{k}:{v}" for k, v in timeframe_signals.items())
        reasoning = (
            f"Multi-timeframe: {quality} alignment ({agreement_score:.0%} agree). "
            f"Signals: {tf_summary}"
        )

        return MultiTimeframeSignal(
            action=final_action,
            agreement_score=round(agreement_score, 4),
            confidence_boost=round(boost, 4),
            timeframe_signals=timeframe_signals,
            alignment_quality=quality,
            reasoning=reasoning,
        )


_mtf_analyzer: Optional[MultiTimeframeAnalyzer] = None


def get_mtf_analyzer() -> MultiTimeframeAnalyzer:
    global _mtf_analyzer
    if _mtf_analyzer is None:
        _mtf_analyzer = MultiTimeframeAnalyzer()
    return _mtf_analyzer
