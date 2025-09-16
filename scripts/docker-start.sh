#!/bin/bash

# Docker startup script for Image Aspect Ratio Converter
# This script starts all services using Docker Compose

set -e

echo "🐳 Starting Image Aspect Ratio Converter with Docker"
echo "===================================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ docker-compose is not installed. Please install docker-compose and try again."
    exit 1
fi

# Create required directories
echo "📁 Creating required directories..."
mkdir -p uploads processed python-service/temp python-service/models backend/logs

# Copy environment files if they don't exist
if [ ! -f ".env" ]; then
    echo "📄 Creating .env file from .env.example..."
    cp .env.example .env
fi

if [ ! -f "backend/.env" ]; then
    echo "📄 Creating backend/.env file from backend/.env.example..."
    cp backend/.env.example backend/.env
fi

if [ ! -f "python-service/.env" ]; then
    echo "📄 Creating python-service/.env file from python-service/.env.example..."
    cp python-service/.env.example python-service/.env
fi

if [ ! -f "frontend/.env" ]; then
    echo "📄 Creating frontend/.env file from frontend/.env.example..."
    cp frontend/.env.example frontend/.env
fi

# Build and start services
echo "🔨 Building Docker images..."
docker-compose build

echo "🚀 Starting services..."
echo "- Python FastAPI service will be available on http://localhost:8000"
echo "- Node.js backend will be available on http://localhost:3001"
echo "- React frontend will be available on http://localhost:3000"
echo ""
echo "Use 'docker-compose logs -f' to view logs"
echo "Use 'docker-compose down' to stop services"
echo ""

docker-compose up -d

echo "✅ All services started successfully!"
echo ""
echo "Health check URLs:"
echo "- Python service: http://localhost:8000/health"
echo "- Node.js backend: http://localhost:3001/health"
echo "- Frontend: http://localhost:3000"