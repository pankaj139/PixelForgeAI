# Image Processing Service

A Python FastAPI service that provides computer vision and image processing capabilities for the Image Aspect Ratio Converter application.

## Features

- Object detection (faces and people)
- Intelligent image cropping
- Aspect ratio conversion
- Batch image processing
- Sheet composition and PDF generation
- RESTful API with automatic documentation

## Quick Start

### Development

1. Create a virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

1. Install dependencies:

```bash
pip install -r requirements.txt
```

1. Copy environment configuration:

```bash
cp .env.example .env
```

1. Run the service:

```bash
python main.py
```

The service will be available at `http://localhost:8000`

### Docker

1. Build the image:

```bash
docker build -t image-processing-service .
```

1. Run the container:

```bash
docker run -p 8000:8000 image-processing-service
```

## API Documentation

Once the service is running, visit:

- Interactive API docs: `http://localhost:8000/docs`
- ReDoc documentation: `http://localhost:8000/redoc`

## Health Check

Check service health at: `http://localhost:8000/health`

## Configuration

The service can be configured using environment variables. See `.env.example` for available options.

## Development Steps

### Running Tests

```bash
pytest
```

### Code Coverage

```bash
pytest --cov=. --cov-report=html
```

## Architecture

This service is designed to work alongside a Node.js backend, handling the computationally intensive image processing tasks while the Node.js service manages API orchestration, file storage, and business logic.
