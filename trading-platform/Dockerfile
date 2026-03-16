# ─────────────────────────────────────────────────────────────────────────────
# FinanceAI Trading Platform — Production Dockerfile
# Single container: builds React frontend, then runs FastAPI backend on port 8000
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

# Install dependencies first (cached layer if package.json unchanged)
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --frozen-lockfile

# Copy source and build
COPY frontend/ ./
RUN npm run build


# ── Stage 2: Python backend ────────────────────────────────────────────────────
FROM python:3.11-slim

# System deps for numpy/pandas/torch (slim image is missing some)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy the built React app into the location FastAPI serves from
# FastAPI looks at: Path(__file__).parent.parent.parent / "frontend" / "dist"
# Which from /app/app/main.py resolves to /app/../../../frontend/dist = /frontend/dist
# So we copy to /frontend/dist
COPY --from=frontend-builder /build/frontend/dist /frontend/dist

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

EXPOSE 8000

# Start the server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
