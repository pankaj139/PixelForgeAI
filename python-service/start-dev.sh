#!/bin/bash

# Development startup script for Image Processing Service

echo "Starting Image Processing Service in development mode..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install/update dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Create necessary directories
mkdir -p models temp uploads processed

# Download OpenCV cascade file if it doesn't exist
if [ ! -f "models/haarcascade_frontalface_default.xml" ]; then
    echo "Downloading OpenCV cascade file..."
    wget -O models/haarcascade_frontalface_default.xml \
        https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml
fi

# Copy environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
fi

# Start the service
echo "Starting FastAPI service..."
python main.py