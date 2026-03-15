"""
Mock Market Data — used when external APIs are unreachable (dev/sandbox env).
Generates realistic OHLCV data and quotes for full platform testing.
Automatically falls back to this when yfinance/newsapi are blocked.
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import random


# Realistic base prices
MOCK_PRICES: Dict[str, Dict] = {
    # US Stocks
    "AAPL":       {"price": 213.49, "name": "Apple Inc.",          "sector": "Technology",  "market": "US"},
    "MSFT":       {"price": 415.32, "name": "Microsoft Corp.",      "sector": "Technology",  "market": "US"},
    "NVDA":       {"price": 875.40, "name": "NVIDIA Corp.",         "sector": "Technology",  "market": "US"},
    "TSLA":       {"price": 172.63, "name": "Tesla Inc.",           "sector": "Automotive",  "market": "US"},
    "GOOGL":      {"price": 179.25, "name": "Alphabet Inc.",        "sector": "Technology",  "market": "US"},
    "AMZN":       {"price": 198.90, "name": "Amazon.com Inc.",      "sector": "Consumer",    "market": "US"},
    "META":       {"price": 552.71, "name": "Meta Platforms",       "sector": "Technology",  "market": "US"},
    "JPM":        {"price": 238.45, "name": "JPMorgan Chase",       "sector": "Finance",     "market": "US"},
    "V":          {"price": 316.82, "name": "Visa Inc.",            "sector": "Finance",     "market": "US"},
    "JNJ":        {"price": 158.23, "name": "Johnson & Johnson",    "sector": "Healthcare",  "market": "US"},
    "WMT":        {"price": 96.74,  "name": "Walmart Inc.",         "sector": "Retail",      "market": "US"},
    "PG":         {"price": 165.39, "name": "Procter & Gamble",     "sector": "Consumer",    "market": "US"},
    "SPY":        {"price": 561.28, "name": "S&P 500 ETF",          "sector": "Index",       "market": "US"},
    "QQQ":        {"price": 482.15, "name": "NASDAQ ETF",           "sector": "Index",       "market": "US"},
    "^DJI":       {"price": 44300,  "name": "Dow Jones",            "sector": "Index",       "market": "US"},
    # India
    "RELIANCE.NS":  {"price": 2945.80, "name": "Reliance Industries","sector": "Energy",   "market": "INDIA"},
    "TCS.NS":       {"price": 4132.50, "name": "TCS",               "sector": "IT",        "market": "INDIA"},
    "HDFCBANK.NS":  {"price": 1785.30, "name": "HDFC Bank",         "sector": "Finance",   "market": "INDIA"},
    "INFY.NS":      {"price": 1892.40, "name": "Infosys Ltd",       "sector": "IT",        "market": "INDIA"},
    "HINDUNILVR.NS":{"price": 2456.70, "name": "Hindustan Unilever","sector": "FMCG",     "market": "INDIA"},
    "ICICIBANK.NS": {"price": 1345.60, "name": "ICICI Bank",        "sector": "Finance",   "market": "INDIA"},
    "SBIN.NS":      {"price": 812.35,  "name": "SBI",               "sector": "Finance",   "market": "INDIA"},
    "WIPRO.NS":     {"price": 567.80,  "name": "Wipro Ltd",         "sector": "IT",        "market": "INDIA"},
    "HCLTECH.NS":   {"price": 1723.40, "name": "HCL Technologies",  "sector": "IT",        "market": "INDIA"},
    "TATAMOTORS.NS":{"price": 1023.50, "name": "Tata Motors",       "sector": "Auto",      "market": "INDIA"},
    "BAJFINANCE.NS":{"price": 8234.60, "name": "Bajaj Finance",     "sector": "Finance",   "market": "INDIA"},
    "ADANIENT.NS":  {"price": 2567.30, "name": "Adani Enterprises", "sector": "Conglom",   "market": "INDIA"},
    "^NSEI":        {"price": 23890.0, "name": "NIFTY 50",          "sector": "Index",     "market": "INDIA"},
    "^BSESN":       {"price": 78674.0, "name": "SENSEX",            "sector": "Index",     "market": "INDIA"},
    # Crypto
    "BTC-USD":   {"price": 97450.0,  "name": "Bitcoin",    "sector": "Cryptocurrency", "market": "CRYPTO"},
    "ETH-USD":   {"price": 3420.50,  "name": "Ethereum",   "sector": "Cryptocurrency", "market": "CRYPTO"},
    "BNB-USD":   {"price": 612.30,   "name": "BNB",        "sector": "Cryptocurrency", "market": "CRYPTO"},
    "SOL-USD":   {"price": 198.75,   "name": "Solana",     "sector": "Cryptocurrency", "market": "CRYPTO"},
    "XRP-USD":   {"price": 2.34,     "name": "XRP",        "sector": "Cryptocurrency", "market": "CRYPTO"},
    "ADA-USD":   {"price": 0.891,    "name": "Cardano",    "sector": "Cryptocurrency", "market": "CRYPTO"},
    "AVAX-USD":  {"price": 43.21,    "name": "Avalanche",  "sector": "Cryptocurrency", "market": "CRYPTO"},
    "DOGE-USD":  {"price": 0.2134,   "name": "Dogecoin",   "sector": "Cryptocurrency", "market": "CRYPTO"},
    "DOT-USD":   {"price": 8.76,     "name": "Polkadot",   "sector": "Cryptocurrency", "market": "CRYPTO"},
    "MATIC-USD": {"price": 0.9823,   "name": "Polygon",    "sector": "Cryptocurrency", "market": "CRYPTO"},
}

MOCK_NEWS = [
    {"title": "Fed signals potential rate cuts as inflation cools", "sentiment": 0.62, "label": "BULLISH", "source": "Reuters"},
    {"title": "NVIDIA reports record GPU demand for AI data centers", "sentiment": 0.78, "label": "BULLISH", "source": "Bloomberg"},
    {"title": "Apple Vision Pro sales exceed analyst expectations", "sentiment": 0.55, "label": "BULLISH", "source": "CNBC"},
    {"title": "Bitcoin surpasses $97,000 as institutional adoption grows", "sentiment": 0.81, "label": "BULLISH", "source": "CoinDesk"},
    {"title": "India's GDP growth forecast raised to 7.2% by IMF", "sentiment": 0.67, "label": "BULLISH", "source": "ET Markets"},
    {"title": "Reliance Jio announces major 5G expansion plan", "sentiment": 0.58, "label": "BULLISH", "source": "Mint"},
    {"title": "Tesla faces production challenges at Berlin Gigafactory", "sentiment": -0.45, "label": "BEARISH", "source": "FT"},
    {"title": "US consumer confidence dips amid economic uncertainty", "sentiment": -0.38, "label": "BEARISH", "source": "WSJ"},
    {"title": "Crypto market sees volatility as regulatory clarity awaited", "sentiment": -0.22, "label": "BEARISH", "source": "CryptoNews"},
    {"title": "S&P 500 touches new all-time highs as tech stocks rally", "sentiment": 0.71, "label": "BULLISH", "source": "MarketWatch"},
    {"title": "Microsoft Azure cloud revenue grows 28% year-over-year", "sentiment": 0.73, "label": "BULLISH", "source": "Bloomberg"},
    {"title": "RBI holds rates steady, supports growth momentum", "sentiment": 0.45, "label": "BULLISH", "source": "Moneycontrol"},
    {"title": "Oil prices stabilize after OPEC+ production agreement", "sentiment": 0.12, "label": "NEUTRAL", "source": "Reuters"},
    {"title": "Gold hits record high as investors seek safe haven assets", "sentiment": -0.15, "label": "NEUTRAL", "source": "CNBC"},
    {"title": "Infosys wins $2B digital transformation deal", "sentiment": 0.69, "label": "BULLISH", "source": "Economic Times"},
]

_rng_seed = 42


def _seeded_random(symbol: str) -> np.random.Generator:
    """Deterministic random per symbol so prices don't jump on every call"""
    seed = sum(ord(c) for c in symbol) % 10000
    return np.random.default_rng(seed + int(datetime.now().timestamp() / 60))


def generate_ohlcv(
    symbol: str,
    n_bars: int = 90,
    base_price: Optional[float] = None,
    volatility: float = 0.015,
) -> pd.DataFrame:
    """Generate realistic OHLCV data using geometric Brownian motion"""
    if base_price is None:
        base_price = MOCK_PRICES.get(symbol, {}).get("price", 100.0)

    rng = _seeded_random(symbol)

    # GBM simulation
    daily_vol = volatility
    drift = 0.0003   # slight upward drift
    returns = rng.normal(drift, daily_vol, n_bars)

    # Add some momentum and mean reversion
    for i in range(1, len(returns)):
        returns[i] += returns[i-1] * 0.1   # slight momentum

    prices = base_price * np.exp(np.cumsum(returns))

    # Build OHLCV
    dates = pd.date_range(end=datetime.now().date(), periods=n_bars, freq='B')
    opens  = prices * (1 + rng.normal(0, 0.002, n_bars))
    highs  = np.maximum(prices, opens) * (1 + abs(rng.normal(0, 0.008, n_bars)))
    lows   = np.minimum(prices, opens) * (1 - abs(rng.normal(0, 0.008, n_bars)))
    volumes = (rng.lognormal(15, 0.5, n_bars)).astype(int)

    df = pd.DataFrame({
        "open":   np.round(opens, 4),
        "high":   np.round(highs, 4),
        "low":    np.round(lows, 4),
        "close":  np.round(prices, 4),
        "volume": volumes,
    }, index=dates)

    return df


def generate_quote(symbol: str) -> Optional[Dict]:
    """Generate a realistic quote with intraday randomness"""
    info = MOCK_PRICES.get(symbol)
    if not info:
        return None

    rng = _seeded_random(symbol + "intraday")
    base = info["price"]
    # Small random intraday move (-2% to +2%)
    change_pct = float(rng.normal(0.003, 0.012))
    price = round(base * (1 + change_pct), 4)
    change = round(price - base, 4)

    return {
        "symbol": symbol,
        "name": info["name"],
        "market": info["market"],
        "sector": info["sector"],
        "price": price,
        "change": change,
        "change_pct": round(change_pct * 100, 2),
        "volume": int(abs(rng.normal(5_000_000, 2_000_000))),
        "market_cap": int(price * abs(rng.normal(1e10, 5e9))),
        "pe_ratio": round(float(abs(rng.normal(25, 8))), 1),
        "high_52w": round(price * 1.35, 4),
        "low_52w": round(price * 0.72, 4),
        "avg_volume": int(abs(rng.normal(4_000_000, 1_000_000))),
        "currency": "USD" if info["market"] in ("US", "CRYPTO") else "INR",
        "timestamp": datetime.utcnow().isoformat(),
        "source": "demo",
    }


def generate_news(symbol: str = "", limit: int = 15) -> List[Dict]:
    """Generate mock news articles"""
    from datetime import datetime, timedelta
    articles = []
    for i, item in enumerate(MOCK_NEWS[:limit]):
        hours_ago = i * 2
        pub = (datetime.utcnow() - timedelta(hours=hours_ago)).isoformat()
        articles.append({
            "title": item["title"],
            "description": item["title"] + ". Market analysts closely watching developments.",
            "url": "#",
            "source": {"name": item["source"]},
            "publishedAt": pub,
            "sentiment_score": item["sentiment"],
            "sentiment_label": item["label"],
            "sentiment_confidence": 0.75,
        })
    return articles


def get_market_overview_mock() -> Dict:
    us_symbols    = ["SPY", "QQQ", "^DJI"]
    india_symbols = ["^NSEI", "^BSESN"]
    crypto_symbols = ["BTC-USD", "ETH-USD"]
    return {
        "US":     [generate_quote(s) for s in us_symbols if generate_quote(s)],
        "INDIA":  [generate_quote(s) for s in india_symbols if generate_quote(s)],
        "CRYPTO": [generate_quote(s) for s in crypto_symbols if generate_quote(s)],
    }
