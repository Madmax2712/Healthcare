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

# Quote cache: 10s TTL (live_feed refreshes real prices faster than this)
_quote_cache = TTLCache(maxsize=500, ttl=10)
_history_cache = TTLCache(maxsize=200, ttl=300)


# Market configurations
US_STOCKS = [
    # Mega-cap tech
    {"symbol": "AAPL",  "name": "Apple Inc.",           "sector": "Technology"},
    {"symbol": "MSFT",  "name": "Microsoft Corp.",       "sector": "Technology"},
    {"symbol": "NVDA",  "name": "NVIDIA Corp.",          "sector": "Technology"},
    {"symbol": "GOOGL", "name": "Alphabet Inc.",         "sector": "Technology"},
    {"symbol": "AMZN",  "name": "Amazon.com Inc.",       "sector": "Consumer"},
    {"symbol": "META",  "name": "Meta Platforms",        "sector": "Technology"},
    {"symbol": "TSLA",  "name": "Tesla Inc.",            "sector": "Automotive"},
    {"symbol": "AVGO",  "name": "Broadcom Inc.",         "sector": "Technology"},
    {"symbol": "ORCL",  "name": "Oracle Corp.",          "sector": "Technology"},
    {"symbol": "CRM",   "name": "Salesforce Inc.",       "sector": "Technology"},
    {"symbol": "ADBE",  "name": "Adobe Inc.",            "sector": "Technology"},
    {"symbol": "AMD",   "name": "AMD",                   "sector": "Technology"},
    {"symbol": "INTC",  "name": "Intel Corp.",           "sector": "Technology"},
    {"symbol": "QCOM",  "name": "Qualcomm Inc.",         "sector": "Technology"},
    {"symbol": "TXN",   "name": "Texas Instruments",     "sector": "Technology"},
    {"symbol": "NFLX",  "name": "Netflix Inc.",          "sector": "Technology"},
    {"symbol": "NOW",   "name": "ServiceNow Inc.",       "sector": "Technology"},
    {"symbol": "INTU",  "name": "Intuit Inc.",           "sector": "Technology"},
    {"symbol": "PANW",  "name": "Palo Alto Networks",    "sector": "Technology"},
    {"symbol": "SNOW",  "name": "Snowflake Inc.",        "sector": "Technology"},
    # Finance
    {"symbol": "JPM",   "name": "JPMorgan Chase",        "sector": "Finance"},
    {"symbol": "V",     "name": "Visa Inc.",             "sector": "Finance"},
    {"symbol": "MA",    "name": "Mastercard Inc.",       "sector": "Finance"},
    {"symbol": "BAC",   "name": "Bank of America",       "sector": "Finance"},
    {"symbol": "GS",    "name": "Goldman Sachs",         "sector": "Finance"},
    {"symbol": "MS",    "name": "Morgan Stanley",        "sector": "Finance"},
    {"symbol": "BRK-B", "name": "Berkshire Hathaway B",  "sector": "Finance"},
    {"symbol": "WFC",   "name": "Wells Fargo",           "sector": "Finance"},
    {"symbol": "C",     "name": "Citigroup Inc.",        "sector": "Finance"},
    {"symbol": "AXP",   "name": "American Express",      "sector": "Finance"},
    {"symbol": "BLK",   "name": "BlackRock Inc.",        "sector": "Finance"},
    {"symbol": "SCHW",  "name": "Charles Schwab",        "sector": "Finance"},
    # Healthcare
    {"symbol": "JNJ",   "name": "Johnson & Johnson",     "sector": "Healthcare"},
    {"symbol": "LLY",   "name": "Eli Lilly & Co.",       "sector": "Healthcare"},
    {"symbol": "UNH",   "name": "UnitedHealth Group",    "sector": "Healthcare"},
    {"symbol": "ABBV",  "name": "AbbVie Inc.",           "sector": "Healthcare"},
    {"symbol": "PFE",   "name": "Pfizer Inc.",           "sector": "Healthcare"},
    {"symbol": "MRK",   "name": "Merck & Co.",           "sector": "Healthcare"},
    {"symbol": "TMO",   "name": "Thermo Fisher Sci.",    "sector": "Healthcare"},
    {"symbol": "ABT",   "name": "Abbott Laboratories",   "sector": "Healthcare"},
    {"symbol": "DHR",   "name": "Danaher Corp.",         "sector": "Healthcare"},
    {"symbol": "AMGN",  "name": "Amgen Inc.",            "sector": "Healthcare"},
    # Consumer
    {"symbol": "WMT",   "name": "Walmart Inc.",          "sector": "Consumer"},
    {"symbol": "PG",    "name": "Procter & Gamble",      "sector": "Consumer"},
    {"symbol": "KO",    "name": "Coca-Cola Co.",         "sector": "Consumer"},
    {"symbol": "PEP",   "name": "PepsiCo Inc.",          "sector": "Consumer"},
    {"symbol": "COST",  "name": "Costco Wholesale",      "sector": "Consumer"},
    {"symbol": "MCD",   "name": "McDonald's Corp.",      "sector": "Consumer"},
    {"symbol": "NKE",   "name": "Nike Inc.",             "sector": "Consumer"},
    {"symbol": "SBUX",  "name": "Starbucks Corp.",       "sector": "Consumer"},
    {"symbol": "TGT",   "name": "Target Corp.",          "sector": "Consumer"},
    {"symbol": "AMZN",  "name": "Amazon.com Inc.",       "sector": "Consumer"},
    # Energy
    {"symbol": "XOM",   "name": "ExxonMobil Corp.",      "sector": "Energy"},
    {"symbol": "CVX",   "name": "Chevron Corp.",         "sector": "Energy"},
    {"symbol": "COP",   "name": "ConocoPhillips",        "sector": "Energy"},
    {"symbol": "SLB",   "name": "SLB (Schlumberger)",    "sector": "Energy"},
    {"symbol": "OXY",   "name": "Occidental Petroleum",  "sector": "Energy"},
    # Industrials
    {"symbol": "BA",    "name": "Boeing Co.",            "sector": "Industrial"},
    {"symbol": "CAT",   "name": "Caterpillar Inc.",      "sector": "Industrial"},
    {"symbol": "HON",   "name": "Honeywell Intl.",       "sector": "Industrial"},
    {"symbol": "RTX",   "name": "RTX Corp.",             "sector": "Industrial"},
    {"symbol": "LMT",   "name": "Lockheed Martin",       "sector": "Industrial"},
    {"symbol": "GE",    "name": "GE Aerospace",          "sector": "Industrial"},
    {"symbol": "MMM",   "name": "3M Company",            "sector": "Industrial"},
    {"symbol": "DE",    "name": "Deere & Company",       "sector": "Industrial"},
    {"symbol": "UPS",   "name": "UPS Inc.",              "sector": "Industrial"},
    {"symbol": "FDX",   "name": "FedEx Corp.",           "sector": "Industrial"},
    # Communication / Media
    {"symbol": "DIS",   "name": "Walt Disney Co.",       "sector": "Media"},
    {"symbol": "CMCSA", "name": "Comcast Corp.",         "sector": "Media"},
    {"symbol": "VZ",    "name": "Verizon Communications","sector": "Telecom"},
    {"symbol": "T",     "name": "AT&T Inc.",             "sector": "Telecom"},
    {"symbol": "TMUS",  "name": "T-Mobile US",           "sector": "Telecom"},
    # Real estate / Utilities
    {"symbol": "NEE",   "name": "NextEra Energy",        "sector": "Utilities"},
    {"symbol": "SO",    "name": "Southern Company",      "sector": "Utilities"},
    {"symbol": "AMT",   "name": "American Tower REIT",   "sector": "Real Estate"},
    {"symbol": "PLD",   "name": "Prologis Inc.",         "sector": "Real Estate"},
    # High-volatility / meme
    {"symbol": "GME",   "name": "GameStop Corp.",        "sector": "Retail"},
    {"symbol": "AMC",   "name": "AMC Networks",          "sector": "Media"},
    {"symbol": "RIVN",  "name": "Rivian Automotive",     "sector": "Automotive"},
    {"symbol": "LCID",  "name": "Lucid Group",           "sector": "Automotive"},
    {"symbol": "PLTR",  "name": "Palantir Technologies", "sector": "Technology"},
    {"symbol": "SOFI",  "name": "SoFi Technologies",     "sector": "Finance"},
    {"symbol": "HOOD",  "name": "Robinhood Markets",     "sector": "Finance"},
    {"symbol": "COIN",  "name": "Coinbase Global",       "sector": "Finance"},
    # ETFs / Index
    {"symbol": "SPY",   "name": "S&P 500 ETF",           "sector": "Index"},
    {"symbol": "QQQ",   "name": "NASDAQ ETF",            "sector": "Index"},
    {"symbol": "IWM",   "name": "Russell 2000 ETF",      "sector": "Index"},
    {"symbol": "VTI",   "name": "Vanguard Total Market", "sector": "Index"},
    {"symbol": "DIA",   "name": "Dow Jones ETF",         "sector": "Index"},
    {"symbol": "XLF",   "name": "Financial Sector ETF",  "sector": "Index"},
    {"symbol": "XLK",   "name": "Tech Sector ETF",       "sector": "Index"},
    {"symbol": "ARKK",  "name": "ARK Innovation ETF",    "sector": "Index"},
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
    """Fetch real-time quote for a symbol.

    Priority:
    1. live_feed (already seeded from CoinGecko / Alpaca / yfinance, refreshed continuously)
    2. yfinance direct call (fallback for symbols not in live_feed)
    3. mock data (last resort)
    """
    if symbol in _quote_cache:
        return _quote_cache[symbol]

    # ── 1. Try live_feed first (fastest — no network call needed) ──────────
    try:
        from app.services.live_feed import live_feed
        tick = live_feed.get_quote(symbol)
        if tick and tick.get("real_price", 0) > 0:
            symbol_info = _get_symbol_info(symbol)
            quote = {
                "symbol": symbol,
                "name": tick.get("name", symbol_info.get("name", symbol)),
                "market": tick.get("market", symbol_info.get("market", "UNKNOWN")),
                "sector": tick.get("sector", symbol_info.get("sector", "Unknown")),
                "price": tick["real_price"],
                "change": tick.get("change", 0),
                "change_pct": tick.get("change_pct", 0),
                "volume": tick.get("volume", 0),
                "open": tick.get("open", tick["real_price"]),
                "high": tick.get("high", tick["real_price"]),
                "low": tick.get("low", tick["real_price"]),
                "prev_close": tick.get("prev_close", tick["real_price"]),
                "market_cap": 0,
                "pe_ratio": None,
                "high_52w": None,
                "low_52w": None,
                "avg_volume": 0,
                "currency": "USD",
                "data_source": tick.get("data_source", "live_feed"),
                "timestamp": tick.get("timestamp", datetime.utcnow().isoformat()),
            }
            _quote_cache[symbol] = quote
            return quote
    except Exception as e:
        logger.debug(f"live_feed quote unavailable for {symbol}: {e}")

    # ── 2. yfinance fallback ───────────────────────────────────────────────
    try:
        import yfinance as yf
        loop = asyncio.get_event_loop()

        def _fetch_info():
            t = yf.Ticker(symbol)
            return t.fast_info

        info = await asyncio.wait_for(
            loop.run_in_executor(None, _fetch_info),
            timeout=8.0
        )

        price = getattr(info, "last_price", None) or getattr(info, "regular_market_price", None) or 0
        prev_close = getattr(info, "previous_close", None) or price
        change = price - prev_close if price and prev_close else 0
        change_pct = (change / prev_close * 100) if prev_close else 0

        symbol_info = _get_symbol_info(symbol)

        quote = {
            "symbol": symbol,
            "name": symbol_info.get("name", symbol),
            "market": symbol_info.get("market", "UNKNOWN"),
            "sector": symbol_info.get("sector", "Unknown"),
            "price": round(float(price), 4) if price else 0,
            "change": round(float(change), 4),
            "change_pct": round(float(change_pct), 2),
            "volume": int(getattr(info, "three_month_average_volume", 0) or 0),
            "market_cap": int(getattr(info, "market_cap", 0) or 0),
            "pe_ratio": None,
            "high_52w": getattr(info, "year_high", None),
            "low_52w": getattr(info, "year_low", None),
            "avg_volume": 0,
            "currency": getattr(info, "currency", "USD"),
            "data_source": "yfinance",
            "timestamp": datetime.utcnow().isoformat(),
        }

        _quote_cache[symbol] = quote
        return quote

    except Exception as e:
        logger.warning(f"yfinance quote failed for {symbol}: {type(e).__name__}")

    # ── 3. Mock data last resort ───────────────────────────────────────────
    from app.services.mock_data import generate_quote
    mock = generate_quote(symbol)
    if mock:
        mock["data_source"] = "mock"
        _quote_cache[symbol] = mock
    return mock


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

        df = await asyncio.wait_for(
            loop.run_in_executor(None, _fetch),
            timeout=5.0
        )

        if df is not None and not df.empty:
            df.columns = [c.lower() for c in df.columns]
            df = df.dropna()
            if not df.empty:
                _history_cache[cache_key] = df
                return df

        # yfinance returned empty — fall through to mock data
        raise ValueError(f"Empty data from yfinance for {symbol}")

    except Exception as e:
        logger.warning(f"yfinance history failed for {symbol}, using mock data: {type(e).__name__}")
        from app.services.mock_data import generate_ohlcv, MOCK_PRICES
        # Determine n_bars from period
        period_days = {"1d": 1, "5d": 5, "1mo": 22, "3mo": 66, "6mo": 132, "1y": 252, "2y": 504}
        n = period_days.get(period, 66)
        base = MOCK_PRICES.get(symbol, {}).get("price", 100.0)
        df = generate_ohlcv(symbol, n_bars=n, base_price=base)
        if df is not None:
            _history_cache[cache_key] = df
        return df


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
