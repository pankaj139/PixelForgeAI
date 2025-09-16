@echo off
REM Development startup script for Image Aspect Ratio Converter (Windows)
REM This script starts all services in development mode

echo 🚀 Starting Image Aspect Ratio Converter in Development Mode
echo ============================================================

REM Check if required directories exist
echo 📁 Creating required directories...
if not exist "uploads" mkdir uploads
if not exist "processed" mkdir processed
if not exist "python-service\temp" mkdir python-service\temp
if not exist "python-service\models" mkdir python-service\models
if not exist "backend\logs" mkdir backend\logs

REM Check if Python service dependencies are installed
echo 🐍 Checking Python service dependencies...
if not exist "python-service\venv" (
    echo Creating Python virtual environment...
    cd python-service
    python -m venv venv
    call venv\Scripts\activate
    pip install -r requirements.txt
    cd ..
) else (
    echo Python virtual environment already exists
)

REM Check if Node.js dependencies are installed
echo 📦 Checking Node.js dependencies...
if not exist "node_modules" (
    echo Installing Node.js dependencies...
    npm install
) else (
    echo Node.js dependencies already installed
)

REM Start services
echo 🔧 Starting services...
echo - Python FastAPI service will run on http://localhost:8000
echo - Node.js backend will run on http://localhost:3001
echo - React frontend will run on http://localhost:3000
echo.
echo Press Ctrl+C to stop all services
echo.

REM Start all services concurrently
npm run dev