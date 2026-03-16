"""
Live Market Data Feed
- Seeds prices from real APIs on startup (CoinGecko, Alpaca, yfinance)
- Refreshes real prices every 10s (crypto), 15s (US), 60s (India)
- Broadcasts 1-second WebSocket ticks using last known real price
  (light GBM interpolation between refreshes for smooth charts)
- Gracefully falls back to hardcoded seed prices if APIs are unavailable
"""
import asyncio
import math
import random
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Callable
import logging

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────
# Fallback seed prices (used only when ALL real APIs fail)
# ──────────────────────────────────────────────────────────────────────
FALLBACK_SEED_PRICES: Dict[str, Dict] = {
    "AAPL":          {"price": 213.49, "name": "Apple Inc.",           "sector": "Technology",     "market": "US",     "vol": 0.0003},
    "MSFT":          {"price": 388.72, "name": "Microsoft Corp.",      "sector": "Technology",     "market": "US",     "vol": 0.0003},
    "GOOGL":         {"price": 172.84, "name": "Alphabet Inc.",        "sector": "Technology",     "market": "US",     "vol": 0.0003},
    "AMZN":          {"price": 203.15, "name": "Amazon.com Inc.",      "sector": "Consumer",       "market": "US",     "vol": 0.0003},
    "NVDA":          {"price": 183.14, "name": "NVIDIA Corp.",         "sector": "Technology",     "market": "US",     "vol": 0.0005},
    "TSLA":          {"price": 247.83, "name": "Tesla Inc.",           "sector": "Automotive",     "market": "US",     "vol": 0.0006},
    "META":          {"price": 589.41, "name": "Meta Platforms",       "sector": "Technology",     "market": "US",     "vol": 0.0004},
    "JPM":           {"price": 242.67, "name": "JPMorgan Chase",       "sector": "Finance",        "market": "US",     "vol": 0.0002},
    "V":             {"price": 321.88, "name": "Visa Inc.",            "sector": "Finance",        "market": "US",     "vol": 0.0002},
    "JNJ":           {"price": 161.42, "name": "Johnson & Johnson",    "sector": "Healthcare",     "market": "US",     "vol": 0.0002},
    "WMT":           {"price": 98.31,  "name": "Walmart Inc.",         "sector": "Retail",         "market": "US",     "vol": 0.0002},
    "PG":            {"price": 167.55, "name": "Procter & Gamble",     "sector": "Consumer",       "market": "US",     "vol": 0.0002},
    "SPY":           {"price": 561.28, "name": "S&P 500 ETF",          "sector": "Index",          "market": "US",     "vol": 0.0002},
    "QQQ":           {"price": 479.32, "name": "NASDAQ ETF",           "sector": "Index",          "market": "US",     "vol": 0.0002},
    "^DJI":          {"price": 44100,  "name": "Dow Jones",            "sector": "Index",          "market": "US",     "vol": 0.0002},
    "RELIANCE.NS":   {"price": 2987.40,"name": "Reliance Industries",  "sector": "Energy",         "market": "INDIA",  "vol": 0.0003},
    "TCS.NS":        {"price": 3892.50,"name": "TCS",                  "sector": "IT",             "market": "INDIA",  "vol": 0.0003},
    "HDFCBANK.NS":   {"price": 1823.75,"name": "HDFC Bank",            "sector": "Finance",        "market": "INDIA",  "vol": 0.0003},
    "INFY.NS":       {"price": 1645.20,"name": "Infosys Ltd",          "sector": "IT",             "market": "INDIA",  "vol": 0.0003},
    "HINDUNILVR.NS": {"price": 2198.60,"name": "Hindustan Unilever",   "sector": "FMCG",           "market": "INDIA",  "vol": 0.0002},
    "ICICIBANK.NS":  {"price": 1287.35,"name": "ICICI Bank",           "sector": "Finance",        "market": "INDIA",  "vol": 0.0003},
    "SBIN.NS":       {"price": 798.45, "name": "SBI",                  "sector": "Finance",        "market": "INDIA",  "vol": 0.0004},
    "WIPRO.NS":      {"price": 312.80, "name": "Wipro Ltd",            "sector": "IT",             "market": "INDIA",  "vol": 0.0004},
    "HCLTECH.NS":    {"price": 1689.90,"name": "HCL Technologies",     "sector": "IT",             "market": "INDIA",  "vol": 0.0003},
    "TATAMOTORS.NS": {"price": 756.30, "name": "Tata Motors",          "sector": "Automotive",     "market": "INDIA",  "vol": 0.0005},
    "BAJFINANCE.NS": {"price": 7892.40,"name": "Bajaj Finance",        "sector": "Finance",        "market": "INDIA",  "vol": 0.0004},
    "ADANIENT.NS":   {"price": 2234.70,"name": "Adani Enterprises",    "sector": "Conglomerate",   "market": "INDIA",  "vol": 0.0006},
    "^NSEI":         {"price": 22650.0,"name": "NIFTY 50",             "sector": "Index",          "market": "INDIA",  "vol": 0.0002},
    "^BSESN":        {"price": 74800.0,"name": "SENSEX",               "sector": "Index",          "market": "INDIA",  "vol": 0.0002},
    "BTC-USD":       {"price": 83245.0,"name": "Bitcoin",              "sector": "Cryptocurrency", "market": "CRYPTO", "vol": 0.0008},
    "ETH-USD":       {"price": 1924.30,"name": "Ethereum",             "sector": "Cryptocurrency", "market": "CRYPTO", "vol": 0.0010},
    "BNB-USD":       {"price": 612.80, "name": "BNB",                  "sector": "Cryptocurrency", "market": "CRYPTO", "vol": 0.0008},
    "SOL-USD":       {"price": 127.45, "name": "Solana",               "sector": "Cryptocurrency", "market": "CRYPTO", "vol": 0.0012},
    "XRP-USD":       {"price": 2.28,   "name": "XRP",                  "sector": "Cryptocurrency", "market": "CRYPTO", "vol": 0.0010},
    "ADA-USD":       {"price": 0.698,  "name": "Cardano",              "sector": "Cryptocurrency", "market": "CRYPTO", "vol": 0.0012},
    "AVAX-USD":      {"price": 21.34,  "name": "Avalanche",            "sector": "Cryptocurrency", "market": "CRYPTO", "vol": 0.0013},
    "DOGE-USD":      {"price": 0.1723, "name": "Dogecoin",             "sector": "Cryptocurrency", "market": "CRYPTO", "vol": 0.0014},
    "DOT-USD":       {"price": 4.92,   "name": "Polkadot",             "sector": "Cryptocurrency", "market": "CRYPTO", "vol": 0.0012},
    "MATIC-USD":     {"price": 0.2341, "name": "Polygon",              "sector": "Cryptocurrency", "market": "CRYPTO", "vol": 0.0012},
}

# Refresh intervals (seconds)
CRYPTO_REFRESH_INTERVAL = 10
US_REFRESH_INTERVAL = 15
INDIA_REFRESH_INTERVAL = 60


class TickState:
    """Tracks real-time price state for one symbol."""

    def __init__(self, symbol: str, info: dict, real_price: Optional[float] = None):
        self.symbol = symbol
        self.info = info
        seed = real_price or info["price"]
        self.price = seed
        self.real_price = seed          # last confirmed real price
        self.open_price = seed
        self.prev_close = seed * (1 + random.gauss(0, 0.002))
        self.high = seed
        self.low = seed
        self.volume = 0
        self.base_volume_per_sec = random.randint(200, 3000)
        self.vol = info.get("vol", 0.0002)
        self.tick_count = 0
        self.last_tick_time = time.time()
        self.data_source = "fallback"

    def update_real_price(self, price: float, change_pct: float = 0.0,
                          volume: int = 0, source: str = "api"):
        """Update with a fresh real price from an external API."""
        self.real_price = price
        self.price = price
        self.high = max(self.high, price)
        self.low = min(self.low, price) if self.low > 0 else price
        if volume:
            self.volume = volume
        self.data_source = source
        if change_pct != 0:
            self.prev_close = round(price / (1 + change_pct / 100), 4)

    def tick(self) -> dict:
        """Generate 1-second tick (minimal noise around real price)."""
        now = time.time()
        dt = now - self.last_tick_time
        self.last_tick_time = now
        self.tick_count += 1

        # Very small GBM noise for smooth chart between refreshes
        z = random.gauss(0, 1)
        diffusion = self.vol * math.sqrt(max(dt, 0.1)) * z

        # Strong mean-reversion back to the confirmed real price
        deviation = (self.price - self.real_price) / max(self.real_price, 0.0001)
        reversion = -0.05 * deviation

        raw_return = diffusion + reversion
        raw_return = max(-0.001, min(0.001, raw_return))   # cap ±0.1% per tick

        new_price = self.price * (1 + raw_return)
        new_price = max(new_price, 0.0001)

        decimals = 6 if self.info["market"] == "CRYPTO" and self.real_price < 1 else 4
        self.price = round(new_price, decimals)
        self.high = max(self.high, self.price)
        self.low = min(self.low, self.price)

        tick_vol = int(abs(random.gauss(self.base_volume_per_sec, self.base_volume_per_sec * 0.3)))
        self.volume += tick_vol

        change = round(self.price - self.prev_close, 4)
        change_pct = round((change / self.prev_close) * 100, 3) if self.prev_close else 0

        return {
            "symbol": self.symbol,
            "name": self.info["name"],
            "market": self.info["market"],
            "sector": self.info["sector"],
            "price": self.price,
            "real_price": self.real_price,
            "open": round(self.open_price, 4),
            "high": round(self.high, 4),
            "low": round(self.low, 4),
            "change": change,
            "change_pct": change_pct,
            "volume": self.volume,
            "prev_close": round(self.prev_close, 4),
            "data_source": self.data_source,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tick": self.tick_count,
        }


class LiveFeedManager:
    def __init__(self):
        self._states: Dict[str, TickState] = {}
        self._callbacks: List[Callable] = []
        self._tick_task: Optional[asyncio.Task] = None
        self._refresh_task: Optional[asyncio.Task] = None
        self._running = False
        self._alpaca_key: str = ""
        self._alpaca_secret: str = ""
        self._init_states()

    def _init_states(self):
        for symbol, info in FALLBACK_SEED_PRICES.items():
            self._states[symbol] = TickState(symbol, info)
        logger.info(f"LiveFeed initialized with {len(self._states)} symbols (fallback prices)")

    def configure(self, alpaca_key: str = "", alpaca_secret: str = ""):
        self._alpaca_key = alpaca_key
        self._alpaca_secret = alpaca_secret

    def get_quote(self, symbol: str) -> Optional[dict]:
        state = self._states.get(symbol)
        return state.tick() if state else None

    def get_all_quotes(self) -> Dict[str, dict]:
        return {sym: state.tick() for sym, state in self._states.items()}

    def get_latest_price(self, symbol: str) -> Optional[float]:
        state = self._states.get(symbol)
        return state.real_price if state else None

    def add_callback(self, fn: Callable):
        self._callbacks.append(fn)

    def remove_callback(self, fn: Callable):
        self._callbacks = [f for f in self._callbacks if f is not fn]

    async def start(self):
        if self._running:
            return
        self._running = True
        await self._refresh_all_prices()
        self._tick_task = asyncio.create_task(self._tick_loop())
        self._refresh_task = asyncio.create_task(self._refresh_loop())
        logger.info("LiveFeed started with real market data")

    async def stop(self):
        self._running = False
        for task in [self._tick_task, self._refresh_task]:
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    async def _refresh_all_prices(self):
        try:
            from app.services.real_data import fetch_all_real_prices
            updates = await fetch_all_real_prices(
                alpaca_key=self._alpaca_key,
                alpaca_secret=self._alpaca_secret,
            )
            for symbol, data in updates.items():
                state = self._states.get(symbol)
                if state and data.get("price"):
                    state.update_real_price(
                        price=data["price"],
                        change_pct=data.get("change_pct", 0.0),
                        volume=data.get("volume", 0),
                        source=data.get("source", "api"),
                    )
            if updates:
                logger.info(f"LiveFeed seeded {len(updates)} real prices on startup")
        except Exception as e:
            logger.warning(f"Startup price seed failed, using fallback prices: {e}")

    async def _refresh_crypto_prices(self):
        try:
            from app.services.real_data import fetch_crypto_prices
            updates = await fetch_crypto_prices()
            for symbol, data in updates.items():
                state = self._states.get(symbol)
                if state and data.get("price"):
                    state.update_real_price(
                        price=data["price"],
                        change_pct=data.get("change_pct", 0.0),
                        volume=data.get("volume", 0),
                        source="coingecko",
                    )
        except Exception as e:
            logger.warning(f"Crypto refresh failed: {e}")

    async def _refresh_us_prices(self):
        try:
            from app.services.real_data import fetch_us_stock_prices, fetch_us_yfinance_prices
            # Try Alpaca first; if empty or keys not set, fall back to yfinance
            updates = await fetch_us_stock_prices(self._alpaca_key, self._alpaca_secret)
            if not updates:
                updates = await fetch_us_yfinance_prices()
            for symbol, data in updates.items():
                state = self._states.get(symbol)
                if state and data.get("price"):
                    state.update_real_price(
                        price=data["price"],
                        change_pct=data.get("change_pct", 0.0),
                        volume=data.get("volume", 0),
                        source=data.get("source", "yfinance"),
                    )
        except Exception as e:
            logger.warning(f"US stock refresh failed: {e}")

    async def _refresh_india_prices(self):
        try:
            from app.services.real_data import fetch_india_stock_prices
            updates = await fetch_india_stock_prices()
            for symbol, data in updates.items():
                state = self._states.get(symbol)
                if state and data.get("price"):
                    state.update_real_price(
                        price=data["price"],
                        change_pct=data.get("change_pct", 0.0),
                        volume=data.get("volume", 0),
                        source="yfinance",
                    )
        except Exception as e:
            logger.warning(f"India stock refresh failed: {e}")

    async def _refresh_loop(self):
        crypto_elapsed = 0
        us_elapsed = 0
        india_elapsed = 0

        while self._running:
            await asyncio.sleep(5)
            crypto_elapsed += 5
            us_elapsed += 5
            india_elapsed += 5

            tasks = []
            if crypto_elapsed >= CRYPTO_REFRESH_INTERVAL:
                tasks.append(self._refresh_crypto_prices())
                crypto_elapsed = 0
            if us_elapsed >= US_REFRESH_INTERVAL:
                tasks.append(self._refresh_us_prices())
                us_elapsed = 0
            if india_elapsed >= INDIA_REFRESH_INTERVAL:
                tasks.append(self._refresh_india_prices())
                india_elapsed = 0

            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)

    async def _tick_loop(self):
        while self._running:
            try:
                ticks = {sym: state.tick() for sym, state in self._states.items()}
                for cb in self._callbacks:
                    try:
                        await cb(ticks)
                    except Exception as e:
                        logger.error(f"LiveFeed callback error: {e}")
            except Exception as e:
                logger.error(f"LiveFeed tick error: {e}")
            await asyncio.sleep(1.0)

    def inject_price_shock(self, symbol: str, direction: float, magnitude: float = 0.01):
        state = self._states.get(symbol)
        if state:
            shock = state.price * magnitude * direction
            state.price = max(state.price + shock, 0.001)
            state.real_price = state.price


# Global singleton
live_feed = LiveFeedManager()
