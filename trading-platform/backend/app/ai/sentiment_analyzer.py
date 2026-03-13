"""
Sentiment Analysis Engine
Uses VADER for fast real-time analysis + keyword-based financial sentiment scoring
"""
import re
from typing import List, Dict, Optional
from dataclasses import dataclass
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import logging

logger = logging.getLogger(__name__)


@dataclass
class SentimentResult:
    score: float           # -1.0 to 1.0
    label: str             # BULLISH, BEARISH, NEUTRAL
    confidence: float      # 0.0 to 1.0
    positive: float
    negative: float
    neutral: float
    compound: float


# Financial lexicon boosts
FINANCIAL_BULLISH_WORDS = {
    "surge", "soar", "rally", "breakout", "bullish", "upgrade", "beat",
    "outperform", "record high", "growth", "profit", "revenue beat",
    "strong buy", "buy", "accumulate", "overweight", "positive",
    "earnings beat", "guidance raised", "dividend increase", "buyback",
    "partnership", "acquisition", "ipo", "launch", "expansion",
    "recovery", "rebound", "bounce", "momentum", "all-time high",
    "नई ऊंचाई", "तेजी", "मुनाफा",  # Hindi bullish terms
}

FINANCIAL_BEARISH_WORDS = {
    "crash", "plunge", "slump", "bearish", "downgrade", "miss",
    "underperform", "sell", "reduce", "underweight", "negative",
    "earnings miss", "guidance cut", "layoffs", "bankruptcy",
    "recession", "inflation", "rate hike", "investigation", "lawsuit",
    "loss", "decline", "fall", "drop", "sell-off", "correction",
    "debt", "default", "warning", "concern", "risk", "volatile",
    "गिरावट", "नुकसान",  # Hindi bearish terms
}


class SentimentAnalyzer:
    def __init__(self):
        self.vader = SentimentIntensityAnalyzer()
        self._add_financial_lexicon()

    def _add_financial_lexicon(self):
        """Boost VADER with financial domain vocabulary"""
        for word in FINANCIAL_BULLISH_WORDS:
            self.vader.lexicon[word] = 2.5
        for word in FINANCIAL_BEARISH_WORDS:
            self.vader.lexicon[word] = -2.5

    def analyze_text(self, text: str) -> SentimentResult:
        """Analyze sentiment of a single text"""
        if not text or not text.strip():
            return SentimentResult(0.0, "NEUTRAL", 0.5, 0.0, 0.0, 1.0, 0.0)

        text_lower = text.lower()

        # VADER analysis
        scores = self.vader.polarity_scores(text)
        compound = scores["compound"]

        # Financial keyword boost
        bullish_count = sum(1 for w in FINANCIAL_BULLISH_WORDS if w in text_lower)
        bearish_count = sum(1 for w in FINANCIAL_BEARISH_WORDS if w in text_lower)

        keyword_boost = (bullish_count - bearish_count) * 0.05
        adjusted_compound = max(-1.0, min(1.0, compound + keyword_boost))

        # Determine label
        if adjusted_compound >= 0.15:
            label = "BULLISH"
        elif adjusted_compound <= -0.15:
            label = "BEARISH"
        else:
            label = "NEUTRAL"

        # Confidence based on strength of signal
        confidence = min(1.0, abs(adjusted_compound) * 1.5 + 0.3)

        return SentimentResult(
            score=adjusted_compound,
            label=label,
            confidence=confidence,
            positive=scores["pos"],
            negative=scores["neg"],
            neutral=scores["neu"],
            compound=adjusted_compound,
        )

    def analyze_batch(self, texts: List[str]) -> Dict:
        """Analyze multiple texts and aggregate"""
        if not texts:
            return {"score": 0.0, "label": "NEUTRAL", "confidence": 0.5, "count": 0}

        results = [self.analyze_text(t) for t in texts]
        scores = [r.score for r in results]
        confidences = [r.confidence for r in results]

        # Weighted average (more confident = more weight)
        total_weight = sum(confidences)
        if total_weight == 0:
            avg_score = 0.0
        else:
            avg_score = sum(s * c for s, c in zip(scores, confidences)) / total_weight

        avg_confidence = sum(confidences) / len(confidences)

        if avg_score >= 0.15:
            label = "BULLISH"
        elif avg_score <= -0.15:
            label = "BEARISH"
        else:
            label = "NEUTRAL"

        bullish = sum(1 for r in results if r.label == "BULLISH")
        bearish = sum(1 for r in results if r.label == "BEARISH")
        neutral = sum(1 for r in results if r.label == "NEUTRAL")

        return {
            "score": round(avg_score, 4),
            "label": label,
            "confidence": round(avg_confidence, 4),
            "count": len(results),
            "bullish_count": bullish,
            "bearish_count": bearish,
            "neutral_count": neutral,
        }

    def analyze_news_articles(self, articles: List[Dict]) -> Dict:
        """Analyze a list of news article dicts with title + description"""
        texts = []
        for article in articles:
            text = f"{article.get('title', '')} {article.get('description', '')}".strip()
            if text:
                texts.append(text)
        return self.analyze_batch(texts)


# Singleton
_analyzer_instance: Optional[SentimentAnalyzer] = None


def get_sentiment_analyzer() -> SentimentAnalyzer:
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = SentimentAnalyzer()
    return _analyzer_instance
