from pydantic_settings import BaseSettings
from typing import List, Optional
import os


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

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./trading.db"

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

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
