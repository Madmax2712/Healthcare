"""
FinanceAI Trading Platform — Main Application
Upgraded: 1-second live feed, multi-agent autonomous trading, WebSocket streaming
"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, AsyncSessionLocal
from app.routes import auth, market, trading, predictions, news, backtest
from app.routes import autotrader

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────
# WebSocket Connection Manager
# ──────────────────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.subscriptions: Dict[WebSocket, Set[str]] = {}

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active_connections.add(ws)
        self.subscriptions[ws] = {"*"}  # subscribe to all by default
        logger.info(f"WS connected. Total: {len(self.active_connections)}")

    def disconnect(self, ws: WebSocket):
        self.active_connections.discard(ws)
        self.subscriptions.pop(ws, None)

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
        dead = set()
        for ws, syms in self.subscriptions.items():
            if symbol in syms or "*" in syms:
                try:
                    await ws.send_json(data)
                except Exception:
                    dead.add(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
_live_feed_task: asyncio.Task = None


async def on_tick(ticks: Dict):
    """Called by LiveFeedManager every second with all price ticks"""
    if not manager.active_connections:
        return
    await manager.broadcast({
        "type": "price_tick",
        "data": ticks,
        "timestamp": datetime.utcnow().isoformat(),
    })


async def db_session_factory():
    """Async context manager that provides a DB session (for agents)"""
    return AsyncSessionLocal()


# ──────────────────────────────────────────────────────────────────────
# Application Lifespan
# ──────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting FinanceAI Trading Platform v2.0...")
    await init_db()
    logger.info("Database initialized")

    # Start live feed (1-second tick)
    from app.services.live_feed import live_feed
    live_feed.add_callback(on_tick)
    await live_feed.start()
    logger.info("Live feed started (1-second ticks)")

    # Start agent orchestrator
    from app.agents.orchestrator import orchestrator
    orchestrator.set_broadcast(manager.broadcast)
    orchestrator.set_db_factory(lambda: AsyncSessionLocal())
    await orchestrator.start()
    logger.info("Agent orchestrator started (6 agents)")

    yield

    # Shutdown
    from app.services.live_feed import live_feed as lf
    await lf.stop()
    from app.agents.orchestrator import orchestrator as orc
    await orc.stop()
    logger.info("Shutdown complete")


# ──────────────────────────────────────────────────────────────────────
# FastAPI App
# ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="FinanceAI Trading Platform",
    description="AI-powered autonomous trading platform — US, India & Crypto markets",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

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
app.include_router(autotrader.router, prefix="/api")


@app.get("/")
async def root():
    return {
        "app": "FinanceAI Trading Platform",
        "version": "2.0.0",
        "status": "running",
        "live_feed": "1-second ticks",
        "agents": ["market_scanner", "signal_agent", "risk_agent", "trade_executor", "position_monitor", "goal_agent"],
        "docs": "/api/docs",
    }


@app.get("/api/health")
async def health():
    from app.services.live_feed import live_feed
    from app.agents.orchestrator import orchestrator
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "ws_connections": len(manager.active_connections),
        "live_feed_symbols": len(live_feed._states),
        "autotrading_users": list(orchestrator._autotrading_users),
    }


# ──────────────────────────────────────────────────────────────────────
# WebSocket Endpoint
# ──────────────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        # Send initial snapshot
        from app.services.live_feed import live_feed
        snapshot = live_feed.get_all_quotes()
        await manager.send_to(ws, {
            "type": "snapshot",
            "data": snapshot,
            "timestamp": datetime.utcnow().isoformat(),
        })

        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type", "")

                if msg_type == "subscribe":
                    symbols = msg.get("symbols", ["*"])
                    manager.subscriptions[ws] = set(symbols)
                    await manager.send_to(ws, {"type": "subscribed", "symbols": symbols})

                elif msg_type == "ping":
                    await manager.send_to(ws, {"type": "pong", "timestamp": datetime.utcnow().isoformat()})

                elif msg_type == "get_quote":
                    symbol = msg.get("symbol")
                    if symbol:
                        q = live_feed.get_quote(symbol)
                        await manager.send_to(ws, {"type": "quote", "data": q})

                elif msg_type == "get_opportunities":
                    from app.agents.orchestrator import orchestrator
                    await manager.send_to(ws, {
                        "type": "opportunities",
                        "data": orchestrator.get_opportunities(8),
                        "signals": orchestrator.get_live_signals(8),
                    })

            except json.JSONDecodeError:
                await manager.send_to(ws, {"type": "error", "message": "Invalid JSON"})

    except WebSocketDisconnect:
        manager.disconnect(ws)
