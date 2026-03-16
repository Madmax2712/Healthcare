"""
Real Market Data Fetchers
- CoinGecko: free, no API key, real-time crypto prices (poll every 10s)
- yfinance:  free, real prices for US + India stocks (poll every 30s)
- Alpaca:    optional — overrides US prices with faster IEX feed if keys set

All fetchers return a dict: { symbol: {"price": float, "change_pct": float, ...} }
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
# yfinance — US + India stocks (free, real prices, no key needed)
# ─────────────────────────────────────────────────────────────────────

ALL_YF_SYMBOLS = [
    # US
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META",
    "JPM", "V", "JNJ", "WMT", "PG", "SPY", "QQQ",
    # India
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS",
    "HINDUNILVR.NS", "ICICIBANK.NS", "SBIN.NS", "WIPRO.NS",
    "HCLTECH.NS", "TATAMOTORS.NS", "BAJFINANCE.NS", "ADANIENT.NS",
    "^NSEI", "^BSESN", "^DJI",
]


async def fetch_yfinance_prices(symbols: list = None) -> Dict[str, Dict]:
    """
    Fetch real prices via yfinance for US and India stocks.
    Uses yf.download() which is faster and more reliable than Ticker.info.
    """
    if symbols is None:
        symbols = ALL_YF_SYMBOLS
    try:
        import yfinance as yf
        loop = asyncio.get_event_loop()

        def _fetch():
            result = {}
            # download last 2 days of daily bars — gives us close + prev_close
            df = yf.download(
                tickers=" ".join(symbols),
                period="2d",
                interval="1d",
                group_by="ticker",
                auto_adjust=True,
                progress=False,
                threads=True,
            )
            if df.empty:
                return result

            for symbol in symbols:
                try:
                    if len(symbols) == 1:
                        sym_df = df
                    else:
                        sym_df = df[symbol] if symbol in df.columns.get_level_values(0) else None
                    if sym_df is None or sym_df.empty:
                        continue
                    sym_df = sym_df.dropna(subset=["Close"])
                    if len(sym_df) < 1:
                        continue
                    price = float(sym_df["Close"].iloc[-1])
                    prev_close = float(sym_df["Close"].iloc[-2]) if len(sym_df) >= 2 else price
                    change_pct = round(((price - prev_close) / prev_close) * 100, 2) if prev_close else 0
                    volume = int(sym_df["Volume"].iloc[-1]) if "Volume" in sym_df.columns else 0
                    result[symbol] = {
                        "price": price,
                        "change_pct": change_pct,
                        "volume": volume,
                        "source": "yfinance",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                except Exception:
                    pass
            return result

        result = await asyncio.wait_for(
            loop.run_in_executor(None, _fetch),
            timeout=30.0,
        )
        logger.info(f"yfinance: fetched {len(result)} prices")
        return result
    except Exception as e:
        logger.warning(f"yfinance fetch failed: {e}")
        return {}


# Keep named aliases for use in live_feed refresh loops
async def fetch_india_stock_prices() -> Dict[str, Dict]:
    india = [
        "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS",
        "HINDUNILVR.NS", "ICICIBANK.NS", "SBIN.NS", "WIPRO.NS",
        "HCLTECH.NS", "TATAMOTORS.NS", "BAJFINANCE.NS", "ADANIENT.NS",
        "^NSEI", "^BSESN",
    ]
    return await fetch_yfinance_prices(india)


async def fetch_us_yfinance_prices() -> Dict[str, Dict]:
    us = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META",
          "JPM", "V", "JNJ", "WMT", "PG", "SPY", "QQQ", "^DJI"]
    return await fetch_yfinance_prices(us)


# ─────────────────────────────────────────────────────────────────────
# Alpaca — US Stocks (optional, faster IEX feed if keys are set)
# ─────────────────────────────────────────────────────────────────────

US_SYMBOLS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
    "TSLA", "META", "JPM", "V", "JNJ", "WMT", "PG",
]

ALPACA_DATA_URL = "https://data.alpaca.markets/v2/stocks/trades/latest"
ALPACA_BARS_URL = "https://data.alpaca.markets/v2/stocks/bars/latest"


async def fetch_us_stock_prices(api_key: str, secret_key: str) -> Dict[str, Dict]:
    """Fetch US stock prices from Alpaca IEX feed (requires free Alpaca account)."""
    if not api_key or not secret_key:
        return {}

    headers = {
        "APCA-API-KEY-ID": api_key,
        "APCA-API-SECRET-KEY": secret_key,
    }
    symbols_str = ",".join(US_SYMBOLS)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                ALPACA_DATA_URL,
                headers=headers,
                params={"symbols": symbols_str, "feed": "iex"},
            )
            resp.raise_for_status()
            trades_data = resp.json().get("trades", {})

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
        logger.warning(f"Alpaca fetch failed (will use yfinance): {e}")
        return {}


# ─────────────────────────────────────────────────────────────────────
# Combined fetcher — yfinance is the guaranteed base, Alpaca overrides
# ─────────────────────────────────────────────────────────────────────

async def fetch_all_real_prices(alpaca_key: str = "", alpaca_secret: str = "") -> Dict[str, Dict]:
    """
    Fetch real prices from all sources concurrently.
    yfinance covers US + India as a reliable base.
    CoinGecko covers crypto.
    Alpaca overrides US prices if keys are configured.
    """
    crypto_task = asyncio.create_task(fetch_crypto_prices())
    yf_task = asyncio.create_task(fetch_yfinance_prices())          # US + India
    alpaca_task = asyncio.create_task(fetch_us_stock_prices(alpaca_key, alpaca_secret))

    crypto, yf_data, alpaca = await asyncio.gather(
        crypto_task, yf_task, alpaca_task, return_exceptions=True
    )

    result: Dict[str, Dict] = {}
    # yfinance base (US + India)
    if isinstance(yf_data, dict):
        result.update(yf_data)
    # Alpaca overrides US if it worked
    if isinstance(alpaca, dict) and alpaca:
        result.update(alpaca)
    # CoinGecko for crypto
    if isinstance(crypto, dict):
        result.update(crypto)

    return result
