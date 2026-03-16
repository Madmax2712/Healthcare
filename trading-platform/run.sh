#!/bin/bash
# FinanceAI Trading Platform — Single-command startup
# Access from any device on the same network: http://<this-machine-ip>:8000

set -e
cd "$(dirname "$0")"

echo "================================================"
echo " FinanceAI Trading Platform"
echo "================================================"

# 1. Build frontend
echo "[1/2] Building React frontend..."
cd frontend
npm install --silent
npm run build
cd ..

# 2. Start backend (serves everything on port 8000)
echo "[2/2] Starting server on port 8000..."
cd backend
source venv/bin/activate 2>/dev/null || python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt -q

# Get local network IP
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "================================================"
echo " Platform is LIVE"
echo "================================================"
echo " Local:    http://localhost:8000"
echo " Network:  http://${LOCAL_IP}:8000"
echo " Mobile:   http://${LOCAL_IP}:8000"
echo " API Docs: http://${LOCAL_IP}:8000/api/docs"
echo "================================================"
echo " Default login: demo / demo1234"
echo " (Register at /register if first time)"
echo " Press Ctrl+C to stop"
echo "================================================"
echo ""

uvicorn app.main:app --host 0.0.0.0 --port 8000
