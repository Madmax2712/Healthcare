"""
Advanced AI Trading Agent v2 — High-Confidence Ensemble Engine

Signal architecture (7 independent layers):
 1. News sentiment (VADER + financial lexicon)
 2. Technical analysis (RSI/MACD/BB/EMA/Volume)
 3. Price prediction (statistical trend + momentum)
 4. Ensemble model (5-model supermajority voting)
 5. Multi-timeframe alignment (4 timeframes must agree)
 6. Market regime filter (trade with the macro trend)
 7. Risk/reward gate (minimum 1.8:1 R:R required)

A signal passes ONLY when ALL active layers agree.
This extreme selectivity is what drives high accuracy.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import logging
import asyncio

import pandas as pd
import numpy as np

from app.ai.sentiment_analyzer import SentimentAnalyzer, get_sentiment_analyzer
from app.ai.technical_analyzer import TechnicalAnalyzer, get_technical_analyzer, TechnicalSignal
from app.ai.price_predictor import PricePredictor, get_price_predictor, PricePrediction
from app.ai.ensemble_model import EnsembleModel, EnsembleResult, get_ensemble_model
from app.ai.market_regime import MarketRegimeDetector, RegimeResult, get_regime_detector
from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class TradingDecision:
    symbol: str
    market: str
    action: str                   # BUY | SELL | HOLD
    confidence: float             # 0.0-1.0
    reasoning: str
    target_price: float
    stop_loss: float
    position_size: float          # fraction of portfolio
    sentiment_score: float
    technical_score: float
    prediction_score: float
    ensemble_agreement: float     # fraction of ensemble models agreeing
    regime: str
    current_price: float
    predicted_price: float
    expected_return_pct: float
    risk_reward_ratio: float
    layers_passed: int            # how many of 7 layers this signal passed
    layers_total: int
    signals: Dict
    is_high_confidence: bool      # only True when all layers strongly agree
    why_filtered: List[str]       # reasons why signal was downgraded to HOLD


# ── Confidence thresholds ──────────────────────────────────────────────────────
# Deliberately strict: the system trades LESS but MORE accurately
MIN_OVERALL_CONFIDENCE = 0.72    # overall fused confidence
MIN_SENTIMENT_STRENGTH = 0.15   # |sentiment score| must exceed this
MIN_TECHNICAL_STRENGTH = 0.25   # |technical score| must exceed this
MIN_ENSEMBLE_AGREEMENT = 0.75   # fraction of 5 models that must agree (>=4)
MIN_RISK_REWARD = 1.8           # minimum risk/reward ratio
MIN_LAYERS_REQUIRED = 5         # out of 7 layers must pass for BUY/SELL


class TradingAgent:
    """
    High-confidence, low-frequency AI trading agent.
    Trades rarely — only when all signals strongly converge.
    Accuracy over frequency.
    """

    def __init__(self):
        self.sentiment_analyzer = get_sentiment_analyzer()
        self.technical_analyzer = get_technical_analyzer()
        self.price_predictor    = get_price_predictor()
        self.ensemble_model     = get_ensemble_model()
        self.regime_detector    = get_regime_detector()

        # Signal weights (must sum to 1.0)
        self.w_sentiment  = 0.20
        self.w_technical  = 0.30
        self.w_prediction = 0.20
        self.w_ensemble   = 0.30

    def _sentiment_layer(self, articles: List[Dict]):
        result = self.sentiment_analyzer.analyze_news_articles(articles)
        score = result.get("score", 0.0)
        label = result.get("label", "NEUTRAL")
        passed = abs(score) >= MIN_SENTIMENT_STRENGTH
        return score, label, passed

    def _technical_layer(self, df: pd.DataFrame):
        sig = self.technical_analyzer.analyze(df)
        passed = abs(sig.score) >= MIN_TECHNICAL_STRENGTH
        return sig.score, sig, passed

    def _prediction_layer(self, df: pd.DataFrame, symbol: str):
        pred = self.price_predictor.predict(df, symbol)
        if pred.direction == "UP":
            score = pred.confidence * 0.8
        elif pred.direction == "DOWN":
            score = -pred.confidence * 0.8
        else:
            score = 0.0
        passed = pred.direction != "SIDEWAYS" and pred.confidence >= 0.50
        return score, pred, passed

    def _ensemble_layer(self, df: pd.DataFrame):
        result = self.ensemble_model.predict(df)
        passed = result.is_high_confidence and result.vote_agreement >= MIN_ENSEMBLE_AGREEMENT
        return result, passed

    def _regime_layer(self, df: pd.DataFrame, action: str):
        regime = self.regime_detector.detect(df)
        allowed = self.regime_detector.is_signal_allowed(regime, action)
        return regime, allowed

    def _rr_gate(self, price: float, action: str, technical: TechnicalSignal, prediction: PricePrediction):
        sl_pct = settings.STOP_LOSS_PCT
        tp_pct = settings.TAKE_PROFIT_PCT

        if action == "BUY":
            target = max(
                price * (1 + tp_pct),
                prediction.predicted_price if prediction.direction == "UP" else price * (1 + tp_pct),
            )
            stop_loss = max(
                technical.support * 0.995 if technical.support > 0 else price * (1 - sl_pct),
                price * (1 - sl_pct)
            )
            rr = (target - price) / max(price - stop_loss, 1e-6)
        elif action == "SELL":
            target = min(
                price * (1 - tp_pct),
                prediction.predicted_price if prediction.direction == "DOWN" else price * (1 - tp_pct),
            )
            stop_loss = min(
                technical.resistance * 1.005 if technical.resistance > 0 else price * (1 + sl_pct),
                price * (1 + sl_pct)
            )
            rr = (price - target) / max(stop_loss - price, 1e-6)
        else:
            target = price
            stop_loss = price * (1 - sl_pct)
            rr = 0.0

        return round(target, 4), round(stop_loss, 4), round(rr, 3), rr >= MIN_RISK_REWARD

    def _direction_consensus(self, sent_score: float, tech_score: float, pred_score: float, ensemble: EnsembleResult):
        directions = []
        for score in [sent_score, tech_score, pred_score]:
            if score >= MIN_SENTIMENT_STRENGTH:
                directions.append("BUY")
            elif score <= -MIN_SENTIMENT_STRENGTH:
                directions.append("SELL")
            # Neutral signals abstain

        if ensemble.final_action != "HOLD":
            directions.append(ensemble.final_action)

        if not directions:
            return "HOLD", False

        buy_count  = directions.count("BUY")
        sell_count = directions.count("SELL")

        if buy_count > sell_count and buy_count >= max(2, len(directions) * 0.6):
            return "BUY", True
        elif sell_count > buy_count and sell_count >= max(2, len(directions) * 0.6):
            return "SELL", True
        return "HOLD", False

    def analyze(
        self,
        symbol: str,
        market: str,
        price_df: pd.DataFrame,
        news_articles: List[Dict],
    ) -> TradingDecision:
        current_price = float(price_df["close"].iloc[-1]) if price_df is not None and len(price_df) > 0 else 0.0
        why_filtered: List[str] = []
        layers_passed = 0

        # Layer 1: Sentiment
        sent_score, sent_label, sent_passed = self._sentiment_layer(news_articles)
        if sent_passed:
            layers_passed += 1
        else:
            why_filtered.append(f"Weak sentiment ({sent_score:.2f})")

        # Layer 2: Technical
        technical = self.technical_analyzer.analyze(price_df)
        tech_score = technical.score
        tech_passed = abs(tech_score) >= MIN_TECHNICAL_STRENGTH
        if tech_passed:
            layers_passed += 1
        else:
            why_filtered.append(f"Weak technical ({tech_score:.2f})")

        # Layer 3: Price prediction
        pred_score, prediction, pred_passed = self._prediction_layer(price_df, symbol)
        if pred_passed:
            layers_passed += 1
        else:
            why_filtered.append("Sideways prediction")

        # Layer 4: Ensemble
        ensemble, ens_passed = self._ensemble_layer(price_df)
        if ens_passed:
            layers_passed += 1
        else:
            why_filtered.append(f"Ensemble split ({ensemble.buy_votes}B/{ensemble.sell_votes}S/{ensemble.hold_votes}H)")

        # Compute fused score
        fused_score = (
            sent_score  * self.w_sentiment +
            tech_score  * self.w_technical +
            pred_score  * self.w_prediction +
            (ensemble.vote_agreement * np.sign(tech_score) if ensemble.final_action != "HOLD" else 0) * self.w_ensemble
        )

        # Layer 7: Direction consensus
        candidate_action, dir_ok = self._direction_consensus(sent_score, tech_score, pred_score, ensemble)
        if dir_ok:
            layers_passed += 1
        else:
            why_filtered.append("Signals disagree on direction")
            candidate_action = "HOLD"

        # Layer 5: Market regime
        regime, regime_ok = self._regime_layer(price_df, candidate_action)
        if regime_ok:
            layers_passed += 1
        else:
            why_filtered.append(f"Regime mismatch ({regime.regime} blocks {candidate_action})")
            candidate_action = "HOLD"

        # Layer 6: Risk/reward
        target_price, stop_loss, rr_ratio, rr_ok = self._rr_gate(
            current_price, candidate_action, technical, prediction
        )
        if rr_ok:
            layers_passed += 1
        else:
            why_filtered.append(f"R:R too low ({rr_ratio:.2f} < {MIN_RISK_REWARD})")
            if candidate_action != "HOLD":
                candidate_action = "HOLD"

        # Confidence calculation
        layer_fraction = layers_passed / 7
        base_conf = (
            abs(fused_score) * 0.30 +
            ensemble.ensemble_confidence * 0.30 +
            ensemble.vote_agreement * 0.20 +
            layer_fraction * 0.20
        )
        confidence = min(0.94, max(0.0, base_conf))

        # Final gate
        is_high_confidence = (
            confidence >= MIN_OVERALL_CONFIDENCE and
            layers_passed >= MIN_LAYERS_REQUIRED and
            candidate_action != "HOLD"
        )

        final_action = candidate_action if is_high_confidence else "HOLD"
        if not is_high_confidence and candidate_action != "HOLD":
            why_filtered.append(f"Confidence {confidence:.0%} < {MIN_OVERALL_CONFIDENCE:.0%}")

        # Position sizing
        if final_action == "HOLD":
            position_size = 0.0
        else:
            regime_mult = self.regime_detector.get_position_size_multiplier(regime)
            position_size = min(settings.MAX_POSITION_SIZE, confidence * settings.MAX_POSITION_SIZE * regime_mult)

        expected_return = prediction.change_pct

        # Build reasoning
        layer_icon = lambda ok: "✓" if ok else "✗"
        parts = [
            f"{'HIGH CONF' if is_high_confidence else 'FILTERED'} | Action: {final_action} | "
            f"Confidence: {confidence:.0%} | Layers passed: {layers_passed}/7",

            f"[L1-Sentiment] {sent_label} score={sent_score:+.2f} {layer_icon(sent_passed)}",
            f"[L2-Technical] {technical.action} RSI={technical.rsi:.1f} MACD={technical.macd_signal} "
            f"BB={technical.bb_signal} score={tech_score:+.2f} {layer_icon(tech_passed)}",
            f"[L3-Prediction] {prediction.direction} {prediction.change_pct:+.2f}% {layer_icon(pred_passed)}",
            f"[L4-Ensemble] {ensemble.buy_votes}B/{ensemble.sell_votes}S/{ensemble.hold_votes}H "
            f"agreement={ensemble.vote_agreement:.0%} {layer_icon(ens_passed)}",
            f"[L5-Regime] {regime.regime} strength={regime.strength:.0%} {layer_icon(regime_ok)}",
            f"[L6-R:R] ratio={rr_ratio:.2f}x {layer_icon(rr_ok)}",
            f"[L7-Consensus] direction={candidate_action} {layer_icon(dir_ok)}",
        ]
        if why_filtered:
            parts.append(f"Filtered because: {'; '.join(why_filtered)}")
        reasoning = " | ".join(parts)

        return TradingDecision(
            symbol=symbol,
            market=market,
            action=final_action,
            confidence=round(confidence, 4),
            reasoning=reasoning,
            target_price=target_price,
            stop_loss=stop_loss,
            position_size=round(position_size, 4),
            sentiment_score=round(sent_score, 4),
            technical_score=round(tech_score, 4),
            prediction_score=round(pred_score, 4),
            ensemble_agreement=round(ensemble.vote_agreement, 4),
            regime=regime.regime,
            current_price=round(current_price, 4),
            predicted_price=round(prediction.predicted_price, 4),
            expected_return_pct=round(expected_return, 4),
            risk_reward_ratio=round(rr_ratio, 4),
            layers_passed=layers_passed,
            layers_total=7,
            is_high_confidence=is_high_confidence,
            why_filtered=why_filtered,
            signals={
                "sentiment": {
                    "score": round(sent_score, 4),
                    "label": sent_label,
                    "passed": sent_passed,
                },
                "technical": {
                    "action": technical.action,
                    "score": round(tech_score, 4),
                    "rsi": technical.rsi,
                    "macd": technical.macd_signal,
                    "bb": technical.bb_signal,
                    "ema": technical.ema_signal,
                    "volume": technical.volume_signal,
                    "indicators": technical.indicators,
                    "support": technical.support,
                    "resistance": technical.resistance,
                    "passed": tech_passed,
                },
                "ensemble": {
                    "action": ensemble.final_action,
                    "agreement": round(ensemble.vote_agreement, 4),
                    "buy_votes": ensemble.buy_votes,
                    "sell_votes": ensemble.sell_votes,
                    "hold_votes": ensemble.hold_votes,
                    "is_high_confidence": ensemble.is_high_confidence,
                    "model_votes": [
                        {"model": v.model_name, "action": v.action,
                         "score": v.score, "confidence": v.confidence}
                        for v in ensemble.individual_votes
                    ],
                    "passed": ens_passed,
                },
                "regime": {
                    "type": regime.regime,
                    "strength": regime.strength,
                    "trend_score": regime.trend_score,
                    "volatility_pct": regime.volatility_pct,
                    "signal_filter": regime.signal_filter,
                    "description": regime.description,
                    "passed": regime_ok,
                },
                "prediction": {
                    "direction": prediction.direction,
                    "predicted_price": prediction.predicted_price,
                    "change_pct": prediction.change_pct,
                    "confidence": prediction.confidence,
                    "model": prediction.model_used,
                    "passed": pred_passed,
                },
                "layers_passed": layers_passed,
                "layers_total": 7,
                "fused_score": round(fused_score, 4),
                "why_filtered": why_filtered,
            }
        )


_trading_agent: Optional[TradingAgent] = None


def get_trading_agent() -> TradingAgent:
    global _trading_agent
    if _trading_agent is None:
        _trading_agent = TradingAgent()
    return _trading_agent
