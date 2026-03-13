"""
Market Data Service
Fetches real-time and historical data for US, India, and Crypto markets
"""
import asyncio
import time
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from cachetools import TTLCache
import pandas as pd
import logging

logger = logging.getLogger(__name__)

# Cache market data for 1 minute
_quote_cache = TTLCache(maxsize=500, ttl=60)
_history_cache = TTLCache(maxsize=200, ttl=300)


# Market configurations
US_STOCKS = [
    {"symbol": "AAPL", "name": "Apple Inc.", "sector": "Technology"},
    {"symbol": "MSFT", "name": "Microsoft Corp.", "sector": "Technology"},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "sector": "Technology"},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "sector": "Consumer"},
    {"symbol": "NVDA", "name": "NVIDIA Corp.", "sector": "Technology"},
    {"symbol": "TSLA", "name": "Tesla Inc.", "sector": "Automotive"},
    {"symbol": "META", "name": "Meta Platforms", "sector": "Technology"},
    {"symbol": "JPM", "name": "JPMorgan Chase", "sector": "Finance"},
    {"symbol": "V", "name": "Visa Inc.", "sector": "Finance"},
    {"symbol": "JNJ", "name": "Johnson & Johnson", "sector": "Healthcare"},
    {"symbol": "WMT", "name": "Walmart Inc.", "sector": "Retail"},
    {"symbol": "PG", "name": "Procter & Gamble", "sector": "Consumer"},
    {"symbol": "SPY", "name": "S&P 500 ETF", "sector": "Index"},
    {"symbol": "QQQ", "name": "NASDAQ ETF", "sector": "Index"},
]

INDIA_STOCKS = [
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "sector": "Energy"},
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services", "sector": "IT"},
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank", "sector": "Finance"},
    {"symbol": "INFY.NS", "name": "Infosys Ltd", "sector": "IT"},
    {"symbol": "HINDUNILVR.NS", "name": "Hindustan Unilever", "sector": "FMCG"},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank", "sector": "Finance"},
    {"symbol": "SBIN.NS", "name": "State Bank of India", "sector": "Finance"},
    {"symbol": "WIPRO.NS", "name": "Wipro Ltd", "sector": "IT"},
    {"symbol": "HCLTECH.NS", "name": "HCL Technologies", "sector": "IT"},
    {"symbol": "TATAMOTORS.NS", "name": "Tata Motors", "sector": "Automotive"},
    {"symbol": "BAJFINANCE.NS", "name": "Bajaj Finance", "sector": "Finance"},
    {"symbol": "ADANIENT.NS", "name": "Adani Enterprises", "sector": "Conglomerate"},
    {"symbol": "^NSEI", "name": "NIFTY 50", "sector": "Index"},
    {"symbol": "^BSESN", "name": "SENSEX", "sector": "Index"},
]

CRYPTO = [
    {"symbol": "BTC-USD", "name": "Bitcoin", "sector": "Cryptocurrency"},
    {"symbol": "ETH-USD", "name": "Ethereum", "sector": "Cryptocurrency"},
    {"symbol": "BNB-USD", "name": "BNB", "sector": "Cryptocurrency"},
    {"symbol": "SOL-USD", "name": "Solana", "sector": "Cryptocurrency"},
    {"symbol": "XRP-USD", "name": "XRP", "sector": "Cryptocurrency"},
    {"symbol": "ADA-USD", "name": "Cardano", "sector": "Cryptocurrency"},
    {"symbol": "AVAX-USD", "name": "Avalanche", "sector": "Cryptocurrency"},
    {"symbol": "DOGE-USD", "name": "Dogecoin", "sector": "Cryptocurrency"},
    {"symbol": "DOT-USD", "name": "Polkadot", "sector": "Cryptocurrency"},
    {"symbol": "MATIC-USD", "name": "Polygon", "sector": "Cryptocurrency"},
]

ALL_SYMBOLS = {
    "US": US_STOCKS,
    "INDIA": INDIA_STOCKS,
    "CRYPTO": CRYPTO,
}


def _get_symbol_info(symbol: str) -> Dict:
    for market, items in ALL_SYMBOLS.items():
        for item in items:
            if item["symbol"] == symbol:
                return {**item, "market": market}
    return {"symbol": symbol, "name": symbol, "market": "UNKNOWN", "sector": "Unknown"}


async def fetch_quote(symbol: str) -> Optional[Dict]:
    """Fetch real-time quote for a symbol"""
    if symbol in _quote_cache:
        return _quote_cache[symbol]

    try:
        import yfinance as yf
        loop = asyncio.get_event_loop()
        ticker = await loop.run_in_executor(None, lambda: yf.Ticker(symbol))
        info = await loop.run_in_executor(None, lambda: ticker.info)

        price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("price") or 0
        prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose") or price
        change = price - prev_close if price and prev_close else 0
        change_pct = (change / prev_close * 100) if prev_close else 0

        symbol_info = _get_symbol_info(symbol)

        quote = {
            "symbol": symbol,
            "name": info.get("longName") or info.get("shortName") or symbol_info.get("name", symbol),
            "market": symbol_info.get("market", "UNKNOWN"),
            "sector": symbol_info.get("sector", info.get("sector", "Unknown")),
            "price": round(float(price), 4) if price else 0,
            "change": round(float(change), 4),
            "change_pct": round(float(change_pct), 2),
            "volume": info.get("regularMarketVolume", 0) or info.get("volume", 0),
            "market_cap": info.get("marketCap", 0),
            "pe_ratio": info.get("trailingPE", None),
            "high_52w": info.get("fiftyTwoWeekHigh", None),
            "low_52w": info.get("fiftyTwoWeekLow", None),
            "avg_volume": info.get("averageVolume", 0),
            "currency": info.get("currency", "USD"),
            "timestamp": datetime.utcnow().isoformat(),
        }

        _quote_cache[symbol] = quote
        return quote

    except Exception as e:
        logger.error(f"Error fetching quote for {symbol}: {e}")
        return None


async def fetch_history(symbol: str, period: str = "3mo", interval: str = "1d") -> Optional[pd.DataFrame]:
    """Fetch historical OHLCV data"""
    cache_key = f"{symbol}_{period}_{interval}"
    if cache_key in _history_cache:
        return _history_cache[cache_key]

    try:
        import yfinance as yf
        loop = asyncio.get_event_loop()

        def _fetch():
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=period, interval=interval)
            return df

        df = await loop.run_in_executor(None, _fetch)

        if df is None or df.empty:
            return None

        df.columns = [c.lower() for c in df.columns]
        df = df.dropna()

        _history_cache[cache_key] = df
        return df

    except Exception as e:
        logger.error(f"Error fetching history for {symbol}: {e}")
        return None


async def fetch_multiple_quotes(symbols: List[str]) -> List[Dict]:
    """Fetch quotes for multiple symbols concurrently"""
    tasks = [fetch_quote(s) for s in symbols]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if r and not isinstance(r, Exception)]


async def get_market_overview() -> Dict:
    """Get top movers and market summary"""
    major_indices = {
        "US": ["SPY", "QQQ", "^DJI"],
        "INDIA": ["^NSEI", "^BSESN"],
        "CRYPTO": ["BTC-USD", "ETH-USD"],
    }

    overview = {}
    for market, symbols in major_indices.items():
        quotes = await fetch_multiple_quotes(symbols)
        overview[market] = quotes

    return overview


def get_all_symbols_list() -> Dict[str, List[Dict]]:
    return ALL_SYMBOLS


def get_symbols_for_market(market: str) -> List[Dict]:
    return ALL_SYMBOLS.get(market.upper(), [])


def history_to_chart_data(df: pd.DataFrame) -> List[Dict]:
    """Convert DataFrame to chart-friendly format"""
    if df is None or df.empty:
        return []

    records = []
    for idx, row in df.iterrows():
        ts = idx.isoformat() if hasattr(idx, "isoformat") else str(idx)
        records.append({
            "time": ts,
            "open": round(float(row.get("open", 0)), 4),
            "high": round(float(row.get("high", 0)), 4),
            "low": round(float(row.get("low", 0)), 4),
            "close": round(float(row.get("close", 0)), 4),
            "volume": int(row.get("volume", 0)),
        })
    return records
