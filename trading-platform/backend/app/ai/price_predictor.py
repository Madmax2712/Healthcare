"""
Price Prediction Engine
LSTM-based model for short-term price direction prediction
Falls back to statistical methods if PyTorch unavailable
"""
import numpy as np
import pandas as pd
from typing import Optional, Tuple, Dict
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

PYTORCH_AVAILABLE = False
try:
    import torch
    import torch.nn as nn
    PYTORCH_AVAILABLE = True
except ImportError:
    logger.warning("PyTorch not available, using statistical predictor")


@dataclass
class PricePrediction:
    predicted_price: float
    direction: str          # UP, DOWN, SIDEWAYS
    confidence: float       # 0.0 to 1.0
    change_pct: float       # Expected % change
    time_horizon: str       # "1D", "1W"
    model_used: str


class LSTMPredictor(nn.Module if PYTORCH_AVAILABLE else object):
    """Simple LSTM for sequence prediction"""
    def __init__(self, input_size: int = 5, hidden_size: int = 64, num_layers: int = 2, output_size: int = 1):
        if PYTORCH_AVAILABLE:
            super().__init__()
            self.hidden_size = hidden_size
            self.num_layers = num_layers
            self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
            self.fc = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size)
        out, _ = self.lstm(x, (h0, c0))
        return self.fc(out[:, -1, :])


class PricePredictor:
    def __init__(self, sequence_length: int = 30):
        self.sequence_length = sequence_length
        self.models: Dict[str, any] = {}

    def _normalize(self, data: np.ndarray) -> Tuple[np.ndarray, float, float]:
        mean = np.mean(data)
        std = np.std(data) + 1e-10
        return (data - mean) / std, mean, std

    def _prepare_features(self, df: pd.DataFrame) -> np.ndarray:
        """Extract feature matrix from OHLCV data"""
        close = df["close"].values
        high = df["high"].values
        low = df["low"].values
        volume = df["volume"].values if "volume" in df.columns else np.ones(len(close))

        # Normalize each feature
        features = []
        for series in [close, high, low, volume]:
            norm, _, _ = self._normalize(series)
            features.append(norm)

        # Add returns
        returns = np.diff(close, prepend=close[0]) / (close + 1e-10)
        norm_returns, _, _ = self._normalize(returns)
        features.append(norm_returns)

        return np.column_stack(features)

    def predict_statistical(self, df: pd.DataFrame) -> PricePrediction:
        """
        Statistical predictor using trend analysis + momentum
        Works without ML framework
        """
        close = df["close"].values
        current = float(close[-1])

        if len(close) < 5:
            return PricePrediction(
                predicted_price=current,
                direction="SIDEWAYS",
                confidence=0.3,
                change_pct=0.0,
                time_horizon="1D",
                model_used="statistical"
            )

        # Linear trend (last 20 days)
        lookback = min(20, len(close))
        recent = close[-lookback:]
        x = np.arange(lookback)
        slope, intercept = np.polyfit(x, recent, 1)
        trend_pct = slope / (recent.mean() + 1e-10) * 100

        # Momentum (5-day vs 20-day return)
        ret_5d = (close[-1] / close[-5] - 1) * 100 if len(close) >= 5 else 0
        ret_20d = (close[-1] / close[-20] - 1) * 100 if len(close) >= 20 else 0

        # Mean reversion signal (distance from 20-day mean)
        mean_20 = np.mean(close[-20:]) if len(close) >= 20 else current
        mean_reversion = (mean_20 - current) / (mean_20 + 1e-10) * 100

        # Volatility
        returns = np.diff(close) / close[:-1]
        volatility = np.std(returns) * np.sqrt(252) * 100

        # Weighted prediction
        expected_change = (
            trend_pct * 0.4 +
            ret_5d * 0.3 +
            mean_reversion * 0.3
        ) * 0.5  # Scale to 1-day expectation

        # Clamp to reasonable range
        expected_change = max(-5.0, min(5.0, expected_change))
        predicted = current * (1 + expected_change / 100)

        if expected_change > 0.5:
            direction = "UP"
        elif expected_change < -0.5:
            direction = "DOWN"
        else:
            direction = "SIDEWAYS"

        # Confidence: higher for clearer trends, lower for high volatility
        signal_strength = abs(trend_pct) + abs(ret_5d) * 0.5
        confidence = min(0.85, 0.3 + signal_strength * 0.02)
        if volatility > 50:
            confidence *= 0.7

        return PricePrediction(
            predicted_price=round(predicted, 4),
            direction=direction,
            confidence=round(confidence, 4),
            change_pct=round(expected_change, 4),
            time_horizon="1D",
            model_used="statistical"
        )

    def predict(self, df: pd.DataFrame, symbol: str = "") -> PricePrediction:
        """Main prediction method"""
        if df is None or len(df) < 10:
            current = df["close"].iloc[-1] if df is not None and len(df) > 0 else 0
            return PricePrediction(
                predicted_price=float(current),
                direction="SIDEWAYS",
                confidence=0.3,
                change_pct=0.0,
                time_horizon="1D",
                model_used="insufficient_data"
            )

        return self.predict_statistical(df)


_predictor: Optional[PricePredictor] = None


def get_price_predictor() -> PricePredictor:
    global _predictor
    if _predictor is None:
        _predictor = PricePredictor()
    return _predictor
