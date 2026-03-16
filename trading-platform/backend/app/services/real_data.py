"""
Real Market Data Fetchers
- CoinGecko: free, no API key, real-time crypto prices (poll every 10s)
- Alpaca:    free account, real-time US stock trades via IEX feed (poll every 15s)
- yfinance:  free, ~15-min delayed India NSE/BSE stocks (poll every 60s)

All fetchers return a dict: { symbol: {"price": float, "change_pct": float, "volume": int} }
Falls back gracefully if any source is unavailable.
"""
import asyncio
import logging
from typing import Dict, Optional
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────
# CoinGecko — Crypto (free, no key)
# ─────────────────────────────────────────────────────────────────────

COINGECKO_IDS: Dict[str, str] = {
    "BTC-USD":   "bitcoin",
    "ETH-USD":   "ethereum",
    "BNB-USD":   "binancecoin",
    "SOL-USD":   "solana",
    "XRP-USD":   "ripple",
    "ADA-USD":   "cardano",
    "AVAX-USD":  "avalanche-2",
    "DOGE-USD":  "dogecoin",
    "DOT-USD":   "polkadot",
    "MATIC-USD": "matic-network",
}

COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price"


async def fetch_crypto_prices() -> Dict[str, Dict]:
    """Fetch real-time crypto prices from CoinGecko (free tier, no key needed)."""
    ids = ",".join(COINGECKO_IDS.values())
    params = {
        "ids": ids,
        "vs_currencies": "usd",
        "include_24hr_change": "true",
        "include_24hr_vol": "true",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(COINGECKO_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        result: Dict[str, Dict] = {}
        # Reverse map: coingecko_id -> symbol
        id_to_symbol = {v: k for k, v in COINGECKO_IDS.items()}
        for cg_id, values in data.items():
            symbol = id_to_symbol.get(cg_id)
            if symbol and "usd" in values:
                result[symbol] = {
                    "price": float(values["usd"]),
                    "change_pct": round(float(values.get("usd_24h_change") or 0), 2),
                    "volume": int(values.get("usd_24h_vol") or 0),
                    "source": "coingecko",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
        logger.info(f"CoinGecko: fetched {len(result)} crypto prices")
        return result
    except Exception as e:
        logger.warning(f"CoinGecko fetch failed: {e}")
        return {}


# ─────────────────────────────────────────────────────────────────────
# Alpaca — US Stocks (free account, IEX real-time feed)
# ─────────────────────────────────────────────────────────────────────

US_SYMBOLS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
    "TSLA", "META", "JPM", "V", "JNJ", "WMT", "PG",
]

ALPACA_DATA_URL = "https://data.alpaca.markets/v2/stocks/trades/latest"
ALPACA_BARS_URL = "https://data.alpaca.markets/v2/stocks/bars/latest"


async def fetch_us_stock_prices(api_key: str, secret_key: str) -> Dict[str, Dict]:
    """Fetch real-time US stock prices from Alpaca (requires free Alpaca account)."""
    if not api_key or not secret_key:
        logger.debug("Alpaca keys not configured, skipping US stock fetch")
        return {}

    headers = {
        "APCA-API-KEY-ID": api_key,
        "APCA-API-SECRET-KEY": secret_key,
    }
    symbols_str = ",".join(US_SYMBOLS)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Latest trade prices
            resp = await client.get(
                ALPACA_DATA_URL,
                headers=headers,
                params={"symbols": symbols_str, "feed": "iex"},
            )
            resp.raise_for_status()
            trades_data = resp.json().get("trades", {})

            # Latest bars for change_pct (prev close)
            bar_resp = await client.get(
                ALPACA_BARS_URL,
                headers=headers,
                params={"symbols": symbols_str, "feed": "iex", "timeframe": "1Day"},
            )
            bar_resp.raise_for_status()
            bars_data = bar_resp.json().get("bars", {})

        result: Dict[str, Dict] = {}
        for symbol in US_SYMBOLS:
            trade = trades_data.get(symbol)
            bar = bars_data.get(symbol)
            if trade and "p" in trade:
                price = float(trade["p"])
                prev_close = float(bar["c"]) if bar and "c" in bar else price
                change_pct = round(((price - prev_close) / prev_close) * 100, 2) if prev_close else 0
                result[symbol] = {
                    "price": price,
                    "change_pct": change_pct,
                    "volume": int(trade.get("s", 0)),
                    "source": "alpaca",
                    "timestamp": trade.get("t", datetime.now(timezone.utc).isoformat()),
                }

        logger.info(f"Alpaca: fetched {len(result)} US stock prices")
        return result
    except Exception as e:
        logger.warning(f"Alpaca fetch failed: {e}")
        return {}


# ─────────────────────────────────────────────────────────────────────
# yfinance — India Stocks (~15-min delayed, free)
# ─────────────────────────────────────────────────────────────────────

INDIA_SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS",
    "HINDUNILVR.NS", "ICICIBANK.NS", "SBIN.NS", "WIPRO.NS",
    "HCLTECH.NS", "TATAMOTORS.NS", "BAJFINANCE.NS", "ADANIENT.NS",
    "^NSEI", "^BSESN",
]


async def fetch_india_stock_prices() -> Dict[str, Dict]:
    """Fetch India stock prices from yfinance (~15-min delayed during market hours)."""
    try:
        import yfinance as yf

        loop = asyncio.get_event_loop()

        def _fetch():
            tickers = yf.Tickers(" ".join(INDIA_SYMBOLS))
            out = {}
            for symbol in INDIA_SYMBOLS:
                try:
                    info = tickers.tickers[symbol].fast_info
                    price = getattr(info, "last_price", None) or getattr(info, "regular_market_price", None)
                    prev_close = getattr(info, "previous_close", None) or price
                    if price:
                        change_pct = round(((price - prev_close) / prev_close) * 100, 2) if prev_close else 0
                        out[symbol] = {
                            "price": float(price),
                            "change_pct": change_pct,
                            "volume": int(getattr(info, "three_month_average_volume", 0) or 0),
                            "source": "yfinance",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                except Exception:
                    pass
            return out

        result = await asyncio.wait_for(
            loop.run_in_executor(None, _fetch),
            timeout=20.0,
        )
        logger.info(f"yfinance: fetched {len(result)} India stock prices")
        return result
    except Exception as e:
        logger.warning(f"yfinance India fetch failed: {e}")
        return {}


# ─────────────────────────────────────────────────────────────────────
# Combined fetcher
# ─────────────────────────────────────────────────────────────────────

async def fetch_all_real_prices(alpaca_key: str = "", alpaca_secret: str = "") -> Dict[str, Dict]:
    """Fetch real prices from all sources concurrently."""
    crypto_task = asyncio.create_task(fetch_crypto_prices())
    us_task = asyncio.create_task(fetch_us_stock_prices(alpaca_key, alpaca_secret))
    india_task = asyncio.create_task(fetch_india_stock_prices())

    crypto, us, india = await asyncio.gather(crypto_task, us_task, india_task, return_exceptions=True)

    result: Dict[str, Dict] = {}
    for data in [crypto, us, india]:
        if isinstance(data, dict):
            result.update(data)
    return result
