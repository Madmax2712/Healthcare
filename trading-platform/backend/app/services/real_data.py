"""
Real Market Data Fetchers
- CoinGecko:  free, no key — real-time crypto (poll every 10s)
- Finnhub:    free key    — real-time US stock quotes (poll every 15s, 60 calls/min limit)
- yfinance:   free, no key — India NSE/BSE with 1-min bars (poll every 60s, ~1-2 min stale)
- Alpaca:     optional override for US stocks if key configured

Priority for US stocks:  Finnhub → Alpaca → yfinance
Priority for Crypto:     CoinGecko → yfinance
Priority for India:      yfinance (1m interval)
"""
import asyncio
import logging
from typing import Dict, List, Optional
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────
# CoinGecko — Crypto real-time (free, no key)
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
    """Real-time crypto from CoinGecko (no key, ~10s freshness)."""
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

        id_to_symbol = {v: k for k, v in COINGECKO_IDS.items()}
        result: Dict[str, Dict] = {}
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
        logger.info(f"CoinGecko: {len(result)} crypto prices")
        return result
    except Exception as e:
        logger.warning(f"CoinGecko failed: {e}")
        return {}


# ─────────────────────────────────────────────────────────────────────
# Finnhub — US Stocks real-time (free key at finnhub.io)
# Free tier: 60 API calls/min
# With 15 symbols polled every 15s → 1 call/symbol/15s = 60 calls/min ✓
# ─────────────────────────────────────────────────────────────────────

US_SYMBOLS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
    "TSLA", "META", "JPM", "V", "JNJ", "WMT", "PG",
    "SPY", "QQQ",
]

FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote"


async def fetch_finnhub_prices(api_key: str) -> Dict[str, Dict]:
    """
    Real-time US stock quotes from Finnhub (free key).
    Fetches all symbols concurrently — each call returns:
      c=current, d=change, dp=change%, h=high, l=low, o=open, pc=prev_close, t=timestamp
    """
    if not api_key:
        return {}

    async def _fetch_one(client: httpx.AsyncClient, symbol: str) -> Optional[Dict]:
        try:
            resp = await client.get(
                FINNHUB_QUOTE_URL,
                params={"symbol": symbol, "token": api_key},
                timeout=6.0,
            )
            resp.raise_for_status()
            d = resp.json()
            price = d.get("c") or 0
            if not price:
                return None
            return {
                "price": float(price),
                "change_pct": round(float(d.get("dp") or 0), 2),
                "change": round(float(d.get("d") or 0), 4),
                "open": float(d.get("o") or price),
                "high": float(d.get("h") or price),
                "low": float(d.get("l") or price),
                "prev_close": float(d.get("pc") or price),
                "volume": 0,
                "source": "finnhub",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except Exception:
            return None

    try:
        async with httpx.AsyncClient() as client:
            tasks = [_fetch_one(client, sym) for sym in US_SYMBOLS]
            results = await asyncio.gather(*tasks, return_exceptions=True)

        out: Dict[str, Dict] = {}
        for sym, res in zip(US_SYMBOLS, results):
            if isinstance(res, dict) and res:
                out[sym] = res

        logger.info(f"Finnhub: {len(out)} US stock prices")
        return out
    except Exception as e:
        logger.warning(f"Finnhub failed: {e}")
        return {}


# ─────────────────────────────────────────────────────────────────────
# Alpaca — US Stocks primary real-time source (free account)
# Uses /v2/stocks/snapshots which returns latestTrade + prevDailyBar
# in a single call — most accurate and efficient endpoint.
# ─────────────────────────────────────────────────────────────────────

ALPACA_SNAPSHOT_URL = "https://data.alpaca.markets/v2/stocks/snapshots"


async def fetch_us_stock_prices(api_key: str, secret_key: str) -> Dict[str, Dict]:
    """
    Real-time US stock prices from Alpaca snapshots endpoint.
    Returns latestTrade price + prevDailyBar for accurate change%.
    """
    if not api_key or not secret_key:
        return {}

    headers = {
        "APCA-API-KEY-ID": api_key,
        "APCA-API-SECRET-KEY": secret_key,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                ALPACA_SNAPSHOT_URL,
                headers=headers,
                params={"symbols": ",".join(US_SYMBOLS), "feed": "iex"},
            )
            resp.raise_for_status()
            snapshots = resp.json()

        result: Dict[str, Dict] = {}
        for symbol, snap in snapshots.items():
            try:
                latest_trade = snap.get("latestTrade") or {}
                daily_bar   = snap.get("dailyBar") or {}
                prev_bar    = snap.get("prevDailyBar") or {}

                price = float(latest_trade.get("p") or daily_bar.get("c") or 0)
                if not price:
                    continue

                prev_close = float(prev_bar.get("c") or price)
                change_pct = round(((price - prev_close) / prev_close) * 100, 2) if prev_close else 0

                result[symbol] = {
                    "price": price,
                    "change_pct": change_pct,
                    "open":  float(daily_bar.get("o") or price),
                    "high":  float(daily_bar.get("h") or price),
                    "low":   float(daily_bar.get("l") or price),
                    "prev_close": prev_close,
                    "volume": int(daily_bar.get("v") or 0),
                    "source": "alpaca",
                    "timestamp": latest_trade.get("t", datetime.now(timezone.utc).isoformat()),
                }
            except Exception:
                continue

        logger.info(f"Alpaca: {len(result)} US stock prices")
        return result
    except Exception as e:
        logger.warning(f"Alpaca failed: {e}")
        return {}


# ─────────────────────────────────────────────────────────────────────
# yfinance — India NSE/BSE with 1-minute bars (~1-2 min stale max)
# ─────────────────────────────────────────────────────────────────────

INDIA_SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS",
    "HINDUNILVR.NS", "ICICIBANK.NS", "SBIN.NS", "WIPRO.NS",
    "HCLTECH.NS", "TATAMOTORS.NS", "BAJFINANCE.NS", "ADANIENT.NS",
    "^NSEI", "^BSESN",
]

ALL_YF_SYMBOLS = US_SYMBOLS + ["^DJI"] + INDIA_SYMBOLS


async def fetch_india_stock_prices() -> Dict[str, Dict]:
    """India NSE/BSE via yfinance 1-minute bars (~1-2 min stale during market hours)."""
    return await _fetch_yfinance(INDIA_SYMBOLS, interval="1m")


async def fetch_us_yfinance_prices() -> Dict[str, Dict]:
    """US stocks via yfinance 1-minute bars — fallback when Finnhub/Alpaca unavailable."""
    return await _fetch_yfinance(US_SYMBOLS + ["^DJI"], interval="1m")


async def _fetch_yfinance(symbols: List[str], interval: str = "1m") -> Dict[str, Dict]:
    """Download recent bars from yfinance. interval='1m' gives ~1-2 min freshness."""
    try:
        import yfinance as yf
        loop = asyncio.get_event_loop()

        def _fetch():
            result = {}
            # period="1d" + interval="1m" → today's 1-minute bars
            df = yf.download(
                tickers=" ".join(symbols),
                period="1d",
                interval=interval,
                group_by="ticker",
                auto_adjust=True,
                progress=False,
                threads=True,
            )
            if df.empty:
                return result

            multi = len(symbols) > 1
            for symbol in symbols:
                try:
                    sym_df = df[symbol] if multi and symbol in df.columns.get_level_values(0) else (df if not multi else None)
                    if sym_df is None or sym_df.empty:
                        continue
                    sym_df = sym_df.dropna(subset=["Close"])
                    if sym_df.empty:
                        continue
                    price = float(sym_df["Close"].iloc[-1])
                    # prev_close = first bar open of today (approximate)
                    prev_close = float(sym_df["Open"].iloc[0]) if len(sym_df) > 0 else price
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

        result = await asyncio.wait_for(loop.run_in_executor(None, _fetch), timeout=30.0)
        logger.info(f"yfinance ({interval}): {len(result)} prices")
        return result
    except Exception as e:
        logger.warning(f"yfinance fetch failed: {e}")
        return {}


# ─────────────────────────────────────────────────────────────────────
# Combined startup fetcher
# ─────────────────────────────────────────────────────────────────────

async def fetch_all_real_prices(
    finnhub_key: str = "",
    alpaca_key: str = "",
    alpaca_secret: str = "",
) -> Dict[str, Dict]:
    """
    Fetch real prices from all sources concurrently on startup.
    Priority: Finnhub/Alpaca for US → yfinance fallback → CoinGecko for crypto.
    """
    crypto_task   = asyncio.create_task(fetch_crypto_prices())
    india_task    = asyncio.create_task(fetch_india_stock_prices())
    finnhub_task  = asyncio.create_task(fetch_finnhub_prices(finnhub_key))
    alpaca_task   = asyncio.create_task(fetch_us_stock_prices(alpaca_key, alpaca_secret))

    crypto, india, finnhub, alpaca = await asyncio.gather(
        crypto_task, india_task, finnhub_task, alpaca_task,
        return_exceptions=True,
    )

    result: Dict[str, Dict] = {}

    # India base
    if isinstance(india, dict):
        result.update(india)

    # US: yfinance as guaranteed fallback, then override with Finnhub/Alpaca
    us_yf = await fetch_us_yfinance_prices()
    result.update(us_yf)
    if isinstance(finnhub, dict) and finnhub:
        result.update(finnhub)
    if isinstance(alpaca, dict) and alpaca:
        result.update(alpaca)    # Alpaca wins — registered account, most accurate

    # Crypto
    if isinstance(crypto, dict):
        result.update(crypto)

    return result
