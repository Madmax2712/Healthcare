"""
AI Trading Agent
Combines sentiment, technical, and price prediction signals
to generate high-confidence trading decisions with risk management
"""
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import logging

from app.ai.sentiment_analyzer import SentimentAnalyzer, get_sentiment_analyzer
from app.ai.technical_analyzer import TechnicalAnalyzer, get_technical_analyzer, TechnicalSignal
from app.ai.price_predictor import PricePredictor, get_price_predictor, PricePrediction
from app.config import settings
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class TradingDecision:
    symbol: str
    market: str
    action: str               # BUY, SELL, HOLD
    confidence: float         # 0.0 to 1.0
    reasoning: str
    target_price: float
    stop_loss: float
    position_size: float      # Fraction of portfolio (0.0 to 1.0)
    sentiment_score: float
    technical_score: float
    prediction_score: float
    current_price: float
    predicted_price: float
    expected_return_pct: float
    risk_reward_ratio: float
    signals: Dict


class TradingAgent:
    """
    Multi-signal AI trading agent with risk management.

    Signal fusion weights:
    - Sentiment (news + social):  30%
    - Technical indicators:       40%
    - Price prediction (LSTM):    30%
    """

    def __init__(self):
        self.sentiment_analyzer = get_sentiment_analyzer()
        self.technical_analyzer = get_technical_analyzer()
        self.price_predictor = get_price_predictor()

        self.sentiment_weight = settings.SENTIMENT_WEIGHT
        self.technical_weight = settings.TECHNICAL_WEIGHT
        self.prediction_weight = settings.PREDICTION_WEIGHT
        self.min_confidence = settings.MIN_CONFIDENCE_THRESHOLD

    def _score_to_action(self, score: float) -> str:
        if score >= 0.3:
            return "BUY"
        elif score <= -0.3:
            return "SELL"
        return "HOLD"

    def _calculate_position_size(self, confidence: float, action: str) -> float:
        """Kelly-inspired position sizing with hard caps"""
        if action == "HOLD":
            return 0.0

        base_size = confidence * settings.MAX_POSITION_SIZE
        # Conservative: never bet more than max_position_size
        return min(base_size, settings.MAX_POSITION_SIZE)

    def _calculate_targets(
        self, current_price: float, action: str, technical: TechnicalSignal, prediction: PricePrediction
    ) -> Tuple[float, float]:
        """Calculate target price and stop-loss"""
        if action == "BUY":
            target = max(
                current_price * (1 + settings.TAKE_PROFIT_PCT),
                prediction.predicted_price if prediction.direction == "UP" else current_price * 1.05,
            )
            stop_loss = current_price * (1 - settings.STOP_LOSS_PCT)
            # Use support as stop if tighter
            if technical.support > 0 and technical.support > stop_loss:
                stop_loss = technical.support * 0.995
        elif action == "SELL":
            target = min(
                current_price * (1 - settings.TAKE_PROFIT_PCT),
                prediction.predicted_price if prediction.direction == "DOWN" else current_price * 0.95,
            )
            stop_loss = current_price * (1 + settings.STOP_LOSS_PCT)
        else:
            target = current_price
            stop_loss = current_price * (1 - settings.STOP_LOSS_PCT)

        return round(target, 4), round(stop_loss, 4)

    def _build_reasoning(
        self,
        action: str,
        sentiment_result: Dict,
        technical: TechnicalSignal,
        prediction: PricePrediction,
        final_score: float,
        confidence: float,
    ) -> str:
        parts = [f"Action: {action} | Confidence: {confidence:.0%}"]

        # Sentiment
        s = sentiment_result
        parts.append(
            f"📰 Sentiment: {s.get('label','NEUTRAL')} "
            f"(score: {s.get('score',0):.2f}, {s.get('count',0)} articles)"
        )

        # Technical
        parts.append(
            f"📊 Technical: {technical.action} | RSI: {technical.rsi:.1f} | "
            f"MACD: {technical.macd_signal} | BB: {technical.bb_signal} | "
            f"EMA: {technical.ema_signal}"
        )

        # Prediction
        parts.append(
            f"🤖 AI Prediction: {prediction.direction} "
            f"({prediction.change_pct:+.2f}%, {prediction.model_used})"
        )

        # Summary
        signal_texts = []
        if s.get("label") == "BULLISH":
            signal_texts.append("positive news sentiment")
        elif s.get("label") == "BEARISH":
            signal_texts.append("negative news sentiment")
        if technical.rsi < 35:
            signal_texts.append("oversold RSI")
        elif technical.rsi > 65:
            signal_texts.append("overbought RSI")
        if technical.macd_signal == "BULLISH":
            signal_texts.append("bullish MACD crossover")
        elif technical.macd_signal == "BEARISH":
            signal_texts.append("bearish MACD crossover")
        if prediction.direction == "UP":
            signal_texts.append(f"predicted {prediction.change_pct:+.1f}% gain")
        elif prediction.direction == "DOWN":
            signal_texts.append(f"predicted {prediction.change_pct:+.1f}% decline")

        if signal_texts:
            parts.append(f"Key signals: {', '.join(signal_texts)}")

        return " | ".join(parts)

    def analyze(
        self,
        symbol: str,
        market: str,
        price_df: pd.DataFrame,
        news_articles: List[Dict],
    ) -> TradingDecision:
        """
        Generate a trading decision for a given symbol.
        """
        current_price = float(price_df["close"].iloc[-1]) if price_df is not None and len(price_df) > 0 else 0.0

        # 1. Sentiment Analysis
        sentiment_result = self.sentiment_analyzer.analyze_news_articles(news_articles)
        sentiment_score = sentiment_result.get("score", 0.0)

        # 2. Technical Analysis
        technical = self.technical_analyzer.analyze(price_df)
        technical_score = technical.score

        # 3. Price Prediction
        prediction = self.price_predictor.predict(price_df, symbol)
        if prediction.direction == "UP":
            pred_score = prediction.confidence * 0.8
        elif prediction.direction == "DOWN":
            pred_score = -prediction.confidence * 0.8
        else:
            pred_score = 0.0

        # 4. Fuse signals (weighted average)
        final_score = (
            sentiment_score * self.sentiment_weight +
            technical_score * self.technical_weight +
            pred_score * self.prediction_weight
        )

        # 5. Confidence = agreement between signals
        signals_agree = []
        for s in [sentiment_score, technical_score, pred_score]:
            signals_agree.append(1 if s > 0.1 else (-1 if s < -0.1 else 0))

        agree_count = sum(1 for s in signals_agree if s == signals_agree[0])
        signal_agreement = agree_count / 3.0

        base_confidence = min(1.0, abs(final_score) * 1.5 + 0.2)
        confidence = base_confidence * (0.5 + signal_agreement * 0.5)
        confidence = min(0.95, confidence)

        # 6. Determine action (requires minimum confidence)
        if confidence < self.min_confidence:
            action = "HOLD"
        else:
            action = self._score_to_action(final_score)

        # 7. Position sizing & targets
        position_size = self._calculate_position_size(confidence, action)
        target_price, stop_loss = self._calculate_targets(current_price, action, technical, prediction)

        # 8. Risk/Reward
        if current_price > 0 and action == "BUY":
            potential_gain = abs(target_price - current_price)
            potential_loss = abs(current_price - stop_loss)
            rr_ratio = potential_gain / (potential_loss + 1e-10)
        elif current_price > 0 and action == "SELL":
            potential_gain = abs(current_price - target_price)
            potential_loss = abs(stop_loss - current_price)
            rr_ratio = potential_gain / (potential_loss + 1e-10)
        else:
            rr_ratio = 1.0

        # Only trade if R:R is favorable
        if rr_ratio < 1.5 and action != "HOLD":
            action = "HOLD"
            confidence *= 0.7

        expected_return = prediction.change_pct

        reasoning = self._build_reasoning(
            action, sentiment_result, technical, prediction, final_score, confidence
        )

        return TradingDecision(
            symbol=symbol,
            market=market,
            action=action,
            confidence=round(confidence, 4),
            reasoning=reasoning,
            target_price=target_price,
            stop_loss=stop_loss,
            position_size=round(position_size, 4),
            sentiment_score=round(sentiment_score, 4),
            technical_score=round(technical_score, 4),
            prediction_score=round(pred_score, 4),
            current_price=round(current_price, 4),
            predicted_price=round(prediction.predicted_price, 4),
            expected_return_pct=round(expected_return, 4),
            risk_reward_ratio=round(rr_ratio, 4),
            signals={
                "sentiment": sentiment_result,
                "technical": {
                    "action": technical.action,
                    "rsi": technical.rsi,
                    "macd": technical.macd_signal,
                    "bb": technical.bb_signal,
                    "ema": technical.ema_signal,
                    "volume": technical.volume_signal,
                    "indicators": technical.indicators,
                    "support": technical.support,
                    "resistance": technical.resistance,
                },
                "prediction": {
                    "direction": prediction.direction,
                    "predicted_price": prediction.predicted_price,
                    "change_pct": prediction.change_pct,
                    "confidence": prediction.confidence,
                },
                "final_score": round(final_score, 4),
            }
        )


_trading_agent: Optional[TradingAgent] = None


def get_trading_agent() -> TradingAgent:
    global _trading_agent
    if _trading_agent is None:
        _trading_agent = TradingAgent()
    return _trading_agent
