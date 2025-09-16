#!/bin/bash

# Development startup script for Image Aspect Ratio Converter
# This script starts all services in development mode

set -e

echo "🚀 Starting Image Aspect Ratio Converter in Development Mode"
echo "============================================================"

# Check if required directories exist
echo "📁 Creating required directories..."
mkdir -p uploads processed python-service/temp python-service/models backend/logs

# Check if Python service dependencies are installed
echo "🐍 Checking Python service dependencies..."
if [ ! -d "python-service/venv" ]; then
    echo "Creating Python virtual environment..."
    cd python-service
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
else
    echo "Python virtual environment already exists"
fi

# Check if Node.js dependencies are installed
echo "📦 Checking Node.js dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
else
    echo "Node.js dependencies already installed"
fi

# Start services
echo "🔧 Starting services..."
echo "- Python FastAPI service will run on http://localhost:8000"
echo "- Node.js backend will run on http://localhost:3001"
echo "- React frontend will run on http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Start all services concurrently
npm run dev