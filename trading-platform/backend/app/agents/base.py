"""Base agent class for all trading agents"""
import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum


class AgentStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    ERROR = "error"
    STOPPED = "stopped"


class AgentLog:
    def __init__(self, agent_name: str, event: str, detail: str,
                 symbol: Optional[str] = None, data: Optional[Dict] = None,
                 level: str = "info"):
        self.agent_name = agent_name
        self.event = event
        self.detail = detail
        self.symbol = symbol
        self.data = data or {}
        self.level = level
        self.timestamp = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict:
        return {
            "agent": self.agent_name,
            "event": self.event,
            "detail": self.detail,
            "symbol": self.symbol,
            "data": self.data,
            "level": self.level,
            "timestamp": self.timestamp,
        }


class BaseAgent(ABC):
    def __init__(self, name: str, interval_seconds: float = 5.0):
        self.name = name
        self.interval = interval_seconds
        self.status = AgentStatus.IDLE
        self.last_run: Optional[datetime] = None
        self.run_count = 0
        self.error_count = 0
        self.logs: List[AgentLog] = []
        self._task: Optional[asyncio.Task] = None
        self._running = False
        self.logger = logging.getLogger(f"agent.{name}")
        self._broadcast_fn = None  # set by orchestrator

    def set_broadcast(self, fn):
        self._broadcast_fn = fn

    async def _emit(self, event: str, detail: str,
                    symbol: Optional[str] = None,
                    data: Optional[Dict] = None,
                    level: str = "info"):
        log = AgentLog(self.name, event, detail, symbol, data, level)
        self.logs.append(log)
        # Keep only last 200 logs
        if len(self.logs) > 200:
            self.logs = self.logs[-200:]

        if self._broadcast_fn:
            try:
                await self._broadcast_fn({
                    "type": "agent_log",
                    "log": log.to_dict(),
                })
            except Exception:
                pass

    async def start(self):
        if self._running:
            return
        self._running = True
        self.status = AgentStatus.RUNNING
        self._task = asyncio.create_task(self._run_loop())
        self.logger.info(f"Agent '{self.name}' started (interval={self.interval}s)")

    async def stop(self):
        self._running = False
        self.status = AgentStatus.STOPPED
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _run_loop(self):
        while self._running:
            try:
                self.last_run = datetime.utcnow()
                self.run_count += 1
                await self.run()
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.error_count += 1
                self.logger.error(f"Agent '{self.name}' error: {e}", exc_info=True)
                await self._emit("error", str(e), level="error")
            await asyncio.sleep(self.interval)

    @abstractmethod
    async def run(self):
        """Override in subclasses — main agent logic"""
        ...

    def get_status(self) -> Dict:
        return {
            "name": self.name,
            "status": self.status.value,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "run_count": self.run_count,
            "error_count": self.error_count,
            "interval_seconds": self.interval,
            "recent_logs": [l.to_dict() for l in self.logs[-10:]],
        }
