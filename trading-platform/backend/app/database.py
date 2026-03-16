from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
import os
from app.config import settings

_db_url = settings.get_database_url()

# Ensure the directory exists before SQLAlchemy tries to open the file
if "sqlite" in _db_url:
    import re
    _path_match = re.search(r"sqlite\+aiosqlite:///(.+)", _db_url)
    if _path_match:
        os.makedirs(os.path.dirname(_path_match.group(1)), exist_ok=True)

engine = create_async_engine(
    _db_url,
    echo=settings.DEBUG,
    connect_args={"check_same_thread": False} if "sqlite" in _db_url else {},
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
