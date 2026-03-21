#!/bin/bash
# Start CRM & Event Management Tool

echo "Starting backend..."
cd backend
pip install -r requirements.txt -q
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

echo "Starting frontend..."
cd ../frontend
npm install -q
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✓ Backend running at http://localhost:8000"
echo "✓ Frontend running at http://localhost:5173"
echo "✓ API docs at http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop"
wait
