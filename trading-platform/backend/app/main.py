"""
FinanceAI Trading Platform - Main FastAPI Application
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Set
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.routes import auth, market, trading, predictions, news
from app.routes import backtest

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.subscriptions: Dict[WebSocket, Set[str]] = {}

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active_connections.add(ws)
        self.subscriptions[ws] = set()
        logger.info(f"WebSocket connected. Total: {len(self.active_connections)}")

    def disconnect(self, ws: WebSocket):
        self.active_connections.discard(ws)
        self.subscriptions.pop(ws, None)
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")

    async def send_to(self, ws: WebSocket, data: dict):
        try:
            await ws.send_json(data)
        except Exception:
            self.disconnect(ws)

    async def broadcast(self, data: dict):
        dead = set()
        for ws in self.active_connections.copy():
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(ws)

    async def broadcast_to_subscribers(self, symbol: str, data: dict):
        """Send price update to subscribers of a symbol"""
        dead = set()
        for ws, symbols in self.subscriptions.items():
            if symbol in symbols or "*" in symbols:
                try:
                    await ws.send_json(data)
                except Exception:
                    dead.add(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
_price_feed_task: asyncio.Task = None


async def price_feed_loop():
    """Background task: push live price updates every 15 seconds"""
    from app.services.market_data import fetch_multiple_quotes, ALL_SYMBOLS

    key_symbols = ["AAPL", "MSFT", "NVDA", "TSLA", "BTC-USD", "ETH-USD", "^NSEI", "RELIANCE.NS"]

    while True:
        try:
            if manager.active_connections:
                quotes = await fetch_multiple_quotes(key_symbols)
                if quotes:
                    await manager.broadcast({
                        "type": "price_update",
                        "data": quotes,
                        "timestamp": datetime.utcnow().isoformat(),
                    })
        except Exception as e:
            logger.error(f"Price feed error: {e}")

        await asyncio.sleep(15)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting FinanceAI Trading Platform...")
    await init_db()
    logger.info("Database initialized")

    global _price_feed_task
    _price_feed_task = asyncio.create_task(price_feed_loop())
    logger.info("Price feed background task started")

    yield

    # Shutdown
    if _price_feed_task:
        _price_feed_task.cancel()
    logger.info("Shutting down...")


app = FastAPI(
    title="FinanceAI Trading Platform",
    description="AI-powered trading platform for US, India, and Crypto markets",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth.router, prefix="/api")
app.include_router(market.router, prefix="/api")
app.include_router(trading.router, prefix="/api")
app.include_router(predictions.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(backtest.router, prefix="/api")


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running",
        "docs": "/api/docs",
        "markets": ["US", "INDIA", "CRYPTO"],
        "paper_trading": settings.PAPER_TRADING,
    }


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "active_ws_connections": len(manager.active_connections),
    }


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type", "")

                if msg_type == "subscribe":
                    symbols = msg.get("symbols", ["*"])
                    manager.subscriptions[ws] = set(symbols)
                    await manager.send_to(ws, {
                        "type": "subscribed",
                        "symbols": list(manager.subscriptions[ws]),
                    })

                elif msg_type == "ping":
                    await manager.send_to(ws, {"type": "pong", "timestamp": datetime.utcnow().isoformat()})

                elif msg_type == "get_quote":
                    symbol = msg.get("symbol")
                    if symbol:
                        from app.services.market_data import fetch_quote
                        quote = await fetch_quote(symbol)
                        await manager.send_to(ws, {"type": "quote", "data": quote})

            except json.JSONDecodeError:
                await manager.send_to(ws, {"type": "error", "message": "Invalid JSON"})

    except WebSocketDisconnect:
        manager.disconnect(ws)
