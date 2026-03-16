from pydantic_settings import BaseSettings
from typing import List, Optional
import os


# Resolve a persistent DB path: prefer /app/data (Render disk mount), else local ./data/
def _default_db_url() -> str:
    data_dir = "/app/data" if os.path.isdir("/app") else os.path.join(os.path.dirname(__file__), "..", "..", "data")
    os.makedirs(data_dir, exist_ok=True)
    return f"sqlite+aiosqlite:///{os.path.abspath(data_dir)}/trading.db"


class Settings(BaseSettings):
    APP_NAME: str = "FinanceAI Trading Platform"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    DEBUG: bool = True
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # API Keys
    NEWS_API_KEY: str = ""
    ALPHA_VANTAGE_KEY: str = ""
    ALPACA_API_KEY: str = ""
    ALPACA_SECRET_KEY: str = ""
    FINNHUB_API_KEY: str = ""     # Free at finnhub.io — real-time US stock quotes

    # Database — absolute path so it never ends up in an ephemeral location
    DATABASE_URL: str = ""

    # Trading
    PAPER_TRADING: bool = True
    INITIAL_BALANCE: float = 100000.0
    MAX_POSITION_SIZE: float = 0.10
    STOP_LOSS_PCT: float = 0.05
    TAKE_PROFIT_PCT: float = 0.15
    MAX_DAILY_LOSS_PCT: float = 0.02

    # AI Weights
    SENTIMENT_WEIGHT: float = 0.30
    TECHNICAL_WEIGHT: float = 0.40
    PREDICTION_WEIGHT: float = 0.30
    MIN_CONFIDENCE_THRESHOLD: float = 0.65

    def get_allowed_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    def get_database_url(self) -> str:
        """Return DATABASE_URL, falling back to a safe absolute path."""
        return self.DATABASE_URL or _default_db_url()

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
