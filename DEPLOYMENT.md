# Deployment Guide

This document provides comprehensive instructions for deploying the Image Aspect Ratio Converter application with its hybrid Node.js + Python architecture.

## Architecture Overview

The application consists of three main services:

1. **Python FastAPI Service** (Port 8000) - Computer vision and image processing
2. **Node.js Backend** (Port 3001) - API orchestration, file management, business logic
3. **React Frontend** (Port 3000) - User interface

## Prerequisites

### Development Environment

- Node.js 18+ and npm 9+
- Python 3.11+
- Git

### Production Environment

- Docker and Docker Compose
- At least 2GB RAM
- 10GB available disk space

## Quick Start

### Option 1: Development Setup

1. **Clone and setup the project:**

   ```bash
   git clone <repository-url>
   cd image-aspect-ratio-converter
   ./scripts/setup.sh
   ```

2. **Start all services:**

   ```bash
   npm run dev
   ```

3. **Access the application:**
   - Frontend: <http://localhost:3000>
   - Backend API: <http://localhost:3001>
   - Python Service: <http://localhost:8000>

### Option 2: Docker Setup

1. **Clone the project:**

   ```bash
   git clone <repository-url>
   cd image-aspect-ratio-converter
   ```

2. **Start with Docker:**

   ```bash
   ./scripts/docker-start.sh
   ```

3. **Access the application:**
   - Frontend: <http://localhost:3000>
   - Backend API: <http://localhost:3001>
   - Python Service: <http://localhost:8000>

## Detailed Setup Instructions

### Development Environment Setup

#### 1. System Requirements

**Node.js Setup:**

```bash
# Install Node.js 18+ (using nvm recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

**Python Setup:**

```bash
# Install Python 3.11+ (using pyenv recommended)
curl https://pyenv.run | bash
pyenv install 3.11.0
pyenv global 3.11.0
```

#### 2. Project Setup

```bash
# Clone repository
git clone <repository-url>
cd image-aspect-ratio-converter

# Run setup script
./scripts/setup.sh

# Or manual setup:
npm install
cd python-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

#### 3. Environment Configuration

Copy and customize environment files:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp python-service/.env.example python-service/.env
cp frontend/.env.example frontend/.env
```

Key configuration options:

**Backend (.env):**

```env
PYTHON_SERVICE_URL=http://localhost:8000
PYTHON_SERVICE_TIMEOUT=30000
PYTHON_SERVICE_MAX_RETRIES=3
```

**Python Service (.env):**

```env
IMAGE_SERVICE_HOST=0.0.0.0
IMAGE_SERVICE_PORT=8000
IMAGE_SERVICE_UPLOAD_DIR=../backend/uploads
IMAGE_SERVICE_PROCESSED_DIR=../backend/processed
```

#### 4. Start Development Services

**All services:**

```bash
npm run dev
```

**Individual services:**

```bash
# Python service only
npm run dev:python

# Backend services only (Python + Node.js)
npm run dev:services

# Frontend only
npm run dev:frontend
```

### Docker Deployment

#### 1. Production Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

#### 2. Development with Docker

```bash
# Start with development overrides
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Or use npm script
npm run docker:dev
```

#### 3. Docker Commands

```bash
# Build images
npm run docker:build

# Start services
npm run docker:up

# Stop services
npm run docker:down

# View logs
npm run docker:logs
```

## Service Configuration

### Python FastAPI Service

**Key Configuration Options:**

- `IMAGE_SERVICE_HOST`: Service host (default: 0.0.0.0)
- `IMAGE_SERVICE_PORT`: Service port (default: 8000)
- `IMAGE_SERVICE_MAX_IMAGE_SIZE`: Maximum image size in bytes
- `IMAGE_SERVICE_FACE_DETECTION_CONFIDENCE`: Face detection threshold
- `IMAGE_SERVICE_PERSON_DETECTION_CONFIDENCE`: Person detection threshold

**Health Check:**

```bash
curl http://localhost:8000/health
```

### Node.js Backend

**Key Configuration Options:**

- `PORT`: Service port (default: 3001)
- `PYTHON_SERVICE_URL`: Python service URL
- `PYTHON_SERVICE_TIMEOUT`: Request timeout to Python service
- `PYTHON_SERVICE_MAX_RETRIES`: Retry attempts for failed requests

**Health Check:**

```bash
curl http://localhost:3001/health
```

### React Frontend

**Key Configuration Options:**

- `VITE_API_BASE_URL`: Backend API URL
- `VITE_MAX_FILE_SIZE`: Maximum upload file size
- `VITE_ALLOWED_FILE_TYPES`: Supported image formats

## Monitoring and Logging

### Health Checks

All services provide health check endpoints:

```bash
# Check all services
npm run health:check

# Individual checks
curl http://localhost:8000/health      # Python service
curl http://localhost:3001/health      # Node.js backend
curl http://localhost:3000             # Frontend
```

### Logging

**Development:**

- Python service: Console output with structured logging
- Node.js backend: Console output with request logging
- Frontend: Browser console

**Production:**

- Python service: File logging to `/app/logs/`
- Node.js backend: File logging to `/app/logs/`
- Docker: Use `docker-compose logs` to view logs

### Monitoring Endpoints

**Python Service:**

```bash
# Detailed health with metrics
curl http://localhost:8000/health/detailed

# Detection capabilities
curl http://localhost:8000/api/v1/detect/stats

# Processing capabilities
curl http://localhost:8000/api/v1/process/stats
```

## Troubleshooting

### Common Issues

#### 1. Python Service Won't Start

**Symptoms:** Connection refused to port 8000

**Solutions:**

```bash
# Check Python dependencies
cd python-service
source venv/bin/activate
pip install -r requirements.txt

# Check for port conflicts
lsof -i :8000

# Check Python service logs
docker-compose logs python-service
```

#### 2. Node.js Backend Can't Connect to Python Service

**Symptoms:** Backend returns 500 errors for image processing

**Solutions:**

```bash
# Verify Python service is running
curl http://localhost:8000/health

# Check environment variables
grep PYTHON_SERVICE_URL backend/.env

# Check network connectivity (Docker)
docker-compose exec nodejs-backend ping python-service
```

#### 3. File Upload Issues

**Symptoms:** Upload fails or files not found

**Solutions:**

```bash
# Check directory permissions
ls -la uploads/ processed/

# Verify volume mounts (Docker)
docker-compose exec python-service ls -la /app/uploads

# Check file size limits
grep MAX_FILE_SIZE backend/.env python-service/.env
```

#### 4. Memory Issues

**Symptoms:** Service crashes during image processing

**Solutions:**

```bash
# Increase Docker memory limits
# Edit docker-compose.yml:
services:
  python-service:
    deploy:
      resources:
        limits:
          memory: 2G

# Check image size limits
grep MAX_IMAGE_SIZE python-service/.env
```

### Performance Optimization

#### 1. Image Processing Performance

```bash
# Adjust confidence thresholds for faster detection
IMAGE_SERVICE_FACE_DETECTION_CONFIDENCE=0.7
IMAGE_SERVICE_PERSON_DETECTION_CONFIDENCE=0.7

# Limit concurrent processing
IMAGE_SERVICE_MAX_WORKERS=4
```

#### 2. Service Communication

```bash
# Adjust timeout settings
PYTHON_SERVICE_TIMEOUT=60000
PYTHON_SERVICE_MAX_RETRIES=5

# Enable connection pooling
PYTHON_SERVICE_POOL_SIZE=10
```

## Security Considerations

### Development

- Services run on localhost only
- CORS enabled for development
- Debug logging enabled

### Production

- Configure proper CORS origins
- Use environment-specific secrets
- Enable HTTPS with reverse proxy
- Implement rate limiting
- Regular security updates

### Environment Variables Security

Never commit sensitive data to version control:

```bash
# Add to .gitignore
.env
backend/.env
python-service/.env
frontend/.env
```

## Scaling and Production Deployment

### Horizontal Scaling

```yaml
# docker-compose.prod.yml
services:
  python-service:
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
  
  nodejs-backend:
    deploy:
      replicas: 2
```

### Load Balancing

Use nginx or similar for load balancing:

```nginx
upstream python_backend {
    server python-service-1:8000;
    server python-service-2:8000;
    server python-service-3:8000;
}

upstream nodejs_backend {
    server nodejs-backend-1:3001;
    server nodejs-backend-2:3001;
}
```

### Database Integration

For production, consider adding a database:

```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: image_converter
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

## Backup and Recovery

### Data Backup

```bash
# Backup uploaded and processed images
tar -czf backup-$(date +%Y%m%d).tar.gz uploads/ processed/

# Backup configuration
tar -czf config-backup-$(date +%Y%m%d).tar.gz *.env backend/.env python-service/.env frontend/.env
```

### Recovery

```bash
# Restore images
tar -xzf backup-20231201.tar.gz

# Restore configuration
tar -xzf config-backup-20231201.tar.gz
```

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review service logs: `docker-compose logs -f`
3. Verify health checks: `npm run health:check`
4. Check GitHub issues for known problems
