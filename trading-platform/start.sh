#!/bin/bash
set -e

echo "🚀 Starting FinanceAI Trading Platform..."

# Setup backend
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env from example"
fi

# Install backend deps
if [ ! -d backend/venv ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv backend/venv
fi

echo "📦 Installing backend dependencies..."
source backend/venv/bin/activate 2>/dev/null || . backend/venv/Scripts/activate 2>/dev/null
pip install -q -r backend/requirements.txt

# Install frontend deps
echo "📦 Installing frontend dependencies..."
cd frontend
npm install --silent
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the services:"
echo "  Backend:  cd backend && uvicorn app.main:app --reload --port 8000"
echo "  Frontend: cd frontend && npm run dev"
echo ""
echo "Or use Docker:"
echo "  docker-compose up --build"
echo ""
echo "API Docs: http://localhost:8000/api/docs"
echo "App:      http://localhost:5173"
