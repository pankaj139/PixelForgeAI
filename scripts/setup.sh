#!/bin/bash

# Setup script for Image Aspect Ratio Converter
# This script sets up the development environment

set -e

echo "🔧 Setting up Image Aspect Ratio Converter Development Environment"
echo "================================================================="

# Check system requirements
echo "🔍 Checking system requirements..."

# Check Node.js
if ! command -v node > /dev/null 2>&1; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js $(node --version) found"

# Check Python
if ! command -v python > /dev/null 2>&1 && ! command -v python3 > /dev/null 2>&1; then
    echo "❌ Python is not installed. Please install Python 3.11+ and try again."
    exit 1
fi

PYTHON_CMD="python"
if command -v python3 > /dev/null 2>&1; then
    PYTHON_CMD="python3"
fi

PYTHON_VERSION=$($PYTHON_CMD --version | cut -d' ' -f2 | cut -d'.' -f1,2)
if [ "$(echo "$PYTHON_VERSION < 3.11" | bc -l)" -eq 1 ]; then
    echo "❌ Python version 3.11+ is required. Current version: $($PYTHON_CMD --version)"
    exit 1
fi

echo "✅ Python $($PYTHON_CMD --version) found"

# Create required directories
echo "📁 Creating required directories..."
mkdir -p uploads processed python-service/temp python-service/models backend/logs scripts

# Setup Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Setup Python environment
echo "🐍 Setting up Python environment..."
cd python-service

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    $PYTHON_CMD -m venv venv
fi

echo "Activating virtual environment and installing dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Download required models
echo "📥 Downloading required models..."
if [ ! -f "models/haarcascade_frontalface_default.xml" ]; then
    echo "Downloading OpenCV face detection model..."
    wget -O models/haarcascade_frontalface_default.xml \
        https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml
fi

cd ..

# Copy environment files
echo "📄 Setting up environment files..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "Created .env file from .env.example"
fi

if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo "Created backend/.env file"
fi

if [ ! -f "python-service/.env" ]; then
    cp python-service/.env.example python-service/.env
    echo "Created python-service/.env file"
fi

if [ ! -f "frontend/.env" ]; then
    cp frontend/.env.example frontend/.env
    echo "Created frontend/.env file"
fi

# Make scripts executable
echo "🔐 Making scripts executable..."
chmod +x scripts/*.sh

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Review and update environment files (.env, backend/.env, python-service/.env, frontend/.env)"
echo "2. Start development servers: npm run dev"
echo "3. Or use Docker: ./scripts/docker-start.sh"
echo ""
echo "Available commands:"
echo "- npm run dev                 # Start all services in development mode"
echo "- npm run dev:services        # Start only backend services (Python + Node.js)"
echo "- npm run test                # Run all tests"
echo "- npm run docker:up           # Start with Docker Compose"
echo "- ./scripts/dev-start.sh      # Alternative development startup"
echo "- ./scripts/docker-start.sh   # Docker startup with setup"