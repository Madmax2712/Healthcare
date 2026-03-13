"""
Advanced Feature Engineering
Extracts 50+ features from OHLCV data for ML models
"""
import numpy as np
import pandas as pd
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


def _safe_series(s: pd.Series) -> pd.Series:
    return s.fillna(0).replace([np.inf, -np.inf], 0)


def compute_all_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extract 50+ engineered features from OHLCV data.
    Returns a DataFrame where each row is a feature vector.
    """
    if df is None or len(df) < 5:
        return pd.DataFrame()

    feat = pd.DataFrame(index=df.index)
    close = df["close"]
    high = df["high"]
    low = df["low"]
    volume = df.get("volume", pd.Series(np.ones(len(df)), index=df.index))
    open_ = df.get("open", close)

    # ── Price returns ──────────────────────────────────────────────────────
    feat["ret_1d"]  = _safe_series(close.pct_change(1))
    feat["ret_3d"]  = _safe_series(close.pct_change(3))
    feat["ret_5d"]  = _safe_series(close.pct_change(5))
    feat["ret_10d"] = _safe_series(close.pct_change(10))
    feat["ret_20d"] = _safe_series(close.pct_change(20))

    # ── Volatility ─────────────────────────────────────────────────────────
    feat["vol_5d"]  = _safe_series(close.pct_change().rolling(5).std())
    feat["vol_20d"] = _safe_series(close.pct_change().rolling(20).std())
    feat["vol_ratio"] = _safe_series(feat["vol_5d"] / (feat["vol_20d"] + 1e-10))

    # Average True Range (ATR)
    tr = pd.concat([
        high - low,
        (high - close.shift(1)).abs(),
        (low - close.shift(1)).abs()
    ], axis=1).max(axis=1)
    feat["atr_14"] = _safe_series(tr.rolling(14).mean() / (close + 1e-10))
    feat["atr_ratio"] = _safe_series(tr / (tr.rolling(14).mean() + 1e-10))

    # ── Moving Averages ────────────────────────────────────────────────────
    for w in [5, 9, 20, 50, 200]:
        sma = close.rolling(w).mean()
        feat[f"sma_{w}_dist"] = _safe_series((close - sma) / (sma + 1e-10))

    feat["ema9"] = _safe_series(close.ewm(span=9).mean())
    feat["ema21"] = _safe_series(close.ewm(span=21).mean())
    feat["ema50"] = _safe_series(close.ewm(span=50).mean())
    feat["ema9_cross_21"] = _safe_series(
        (feat["ema9"] - feat["ema21"]) / (feat["ema21"] + 1e-10)
    )
    feat["ema21_cross_50"] = _safe_series(
        (feat["ema21"] - feat["ema50"]) / (feat["ema50"] + 1e-10)
    )

    # ── Momentum ───────────────────────────────────────────────────────────
    # RSI
    delta = close.diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / (loss + 1e-10)
    feat["rsi_14"] = _safe_series(100 - 100 / (1 + rs))
    feat["rsi_norm"] = (feat["rsi_14"] - 50) / 50   # -1 to 1

    # Stochastic Oscillator
    low_14 = low.rolling(14).min()
    high_14 = high.rolling(14).max()
    feat["stoch_k"] = _safe_series((close - low_14) / (high_14 - low_14 + 1e-10) * 100)
    feat["stoch_d"] = _safe_series(feat["stoch_k"].rolling(3).mean())

    # Williams %R
    feat["williams_r"] = _safe_series(-100 * (high_14 - close) / (high_14 - low_14 + 1e-10))

    # Rate of Change
    feat["roc_5"]  = _safe_series((close / close.shift(5) - 1) * 100)
    feat["roc_10"] = _safe_series((close / close.shift(10) - 1) * 100)

    # ── MACD ───────────────────────────────────────────────────────────────
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()
    feat["macd_norm"] = _safe_series(macd / (close + 1e-10))
    feat["macd_hist"] = _safe_series((macd - signal) / (close + 1e-10))
    feat["macd_cross"] = _safe_series(np.sign(macd - signal))

    # ── Bollinger Bands ────────────────────────────────────────────────────
    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    feat["bb_upper_dist"] = _safe_series((close - (sma20 + 2*std20)) / (close + 1e-10))
    feat["bb_lower_dist"] = _safe_series((close - (sma20 - 2*std20)) / (close + 1e-10))
    feat["bb_width"] = _safe_series(4 * std20 / (sma20 + 1e-10))
    feat["bb_position"] = _safe_series((close - (sma20 - 2*std20)) / (4*std20 + 1e-10))

    # ── Volume ─────────────────────────────────────────────────────────────
    avg_vol_20 = volume.rolling(20).mean()
    feat["vol_norm"] = _safe_series(volume / (avg_vol_20 + 1e-10))
    feat["obv"] = _safe_series(
        (np.sign(close.diff()) * volume).cumsum() / (volume.cumsum() + 1e-10)
    )

    # Price * Volume momentum
    pv = close * volume
    feat["pv_trend"] = _safe_series(pv.rolling(5).mean() / (pv.rolling(20).mean() + 1e-10))

    # ── Candlestick patterns ───────────────────────────────────────────────
    body = close - open_
    feat["candle_body"] = _safe_series(body / (close + 1e-10))
    feat["upper_shadow"] = _safe_series((high - close.where(close > open_, open_)) / (close + 1e-10))
    feat["lower_shadow"] = _safe_series((close.where(close < open_, open_) - low) / (close + 1e-10))
    feat["doji"] = (feat["candle_body"].abs() < 0.002).astype(float)

    # ── Trend strength ─────────────────────────────────────────────────────
    # ADX-like (directional movement)
    dm_plus = (high.diff()).where(high.diff() > (-low.diff()).clip(lower=0), 0).clip(lower=0)
    dm_minus = (-low.diff()).where(-low.diff() > high.diff().clip(lower=0), 0).clip(lower=0)
    feat["dm_ratio"] = _safe_series(
        dm_plus.rolling(14).mean() / (dm_minus.rolling(14).mean() + 1e-10)
    )

    # Linear regression slope (trend)
    for w in [5, 10, 20]:
        x = np.arange(w)
        slopes = close.rolling(w).apply(
            lambda y: np.polyfit(x, y, 1)[0] / (y.mean() + 1e-10) if len(y) == w else 0,
            raw=True
        )
        feat[f"trend_slope_{w}"] = _safe_series(slopes)

    # ── Seasonality / time features ────────────────────────────────────────
    if hasattr(df.index, 'dayofweek'):
        feat["day_of_week"] = df.index.dayofweek / 4.0
        feat["month"] = df.index.month / 12.0

    feat = feat.fillna(0).replace([np.inf, -np.inf], 0)
    return feat


def get_latest_features(df: pd.DataFrame) -> Optional[np.ndarray]:
    """Get feature vector for the latest bar"""
    feat_df = compute_all_features(df)
    if feat_df.empty:
        return None
    return feat_df.iloc[-1].values


def get_feature_names(df: pd.DataFrame) -> list:
    feat_df = compute_all_features(df)
    return list(feat_df.columns)
