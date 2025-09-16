#!/bin/bash

# Verification script for Image Aspect Ratio Converter setup
# This script verifies that all configuration files and dependencies are properly set up

set -e

echo "🔍 Verifying Image Aspect Ratio Converter Setup"
echo "=============================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check system requirements
echo "📋 Checking System Requirements..."

# Check Node.js
if command -v node > /dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    print_status 0 "Node.js found: $NODE_VERSION"
else
    print_status 1 "Node.js not found"
fi

# Check npm
if command -v npm > /dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    print_status 0 "npm found: $NPM_VERSION"
else
    print_status 1 "npm not found"
fi

# Check Python
PYTHON_CMD=""
if command -v python3 > /dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python > /dev/null 2>&1; then
    PYTHON_CMD="python"
fi

if [ -n "$PYTHON_CMD" ]; then
    PYTHON_VERSION=$($PYTHON_CMD --version)
    print_status 0 "Python found: $PYTHON_VERSION"
else
    print_status 1 "Python not found"
fi

# Check Docker (optional)
if command -v docker > /dev/null 2>&1; then
    DOCKER_VERSION=$(docker --version)
    print_status 0 "Docker found: $DOCKER_VERSION"
else
    print_warning "Docker not found (optional for development)"
fi

# Check Docker Compose (optional)
if command -v docker-compose > /dev/null 2>&1; then
    COMPOSE_VERSION=$(docker-compose --version)
    print_status 0 "Docker Compose found: $COMPOSE_VERSION"
else
    print_warning "Docker Compose not found (optional for development)"
fi

echo ""
echo "📁 Checking Project Structure..."

# Check required directories
REQUIRED_DIRS=("frontend" "backend" "python-service" "scripts")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        print_status 0 "Directory exists: $dir"
    else
        print_status 1 "Directory missing: $dir"
    fi
done

# Check configuration files
echo ""
echo "⚙️  Checking Configuration Files..."

CONFIG_FILES=(
    "package.json"
    "docker-compose.yml"
    "docker-compose.dev.yml"
    ".env.example"
    "backend/package.json"
    "backend/.env.example"
    "backend/Dockerfile"
    "python-service/requirements.txt"
    "python-service/.env.example"
    "python-service/Dockerfile"
    "python-service/main.py"
    "frontend/package.json"
    "frontend/.env.example"
    "frontend/Dockerfile"
    "frontend/nginx.conf"
)

for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_status 0 "Configuration file exists: $file"
    else
        print_status 1 "Configuration file missing: $file"
    fi
done

# Check scripts
echo ""
echo "📜 Checking Scripts..."

SCRIPT_FILES=(
    "scripts/setup.sh"
    "scripts/dev-start.sh"
    "scripts/docker-start.sh"
    "scripts/verify-setup.sh"
)

for script in "${SCRIPT_FILES[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            print_status 0 "Script exists and is executable: $script"
        else
            print_warning "Script exists but not executable: $script"
        fi
    else
        print_status 1 "Script missing: $script"
    fi
done

# Check Node.js dependencies
echo ""
echo "📦 Checking Dependencies..."

if [ -d "node_modules" ]; then
    print_status 0 "Node.js dependencies installed"
else
    print_warning "Node.js dependencies not installed (run 'npm install')"
fi

if [ -d "backend/node_modules" ]; then
    print_status 0 "Backend dependencies installed"
else
    print_warning "Backend dependencies not installed"
fi

if [ -d "frontend/node_modules" ]; then
    print_status 0 "Frontend dependencies installed"
else
    print_warning "Frontend dependencies not installed"
fi

# Check Python virtual environment
if [ -d "python-service/venv" ]; then
    print_status 0 "Python virtual environment exists"
    
    # Check if requirements are installed
    if [ -f "python-service/venv/pyvenv.cfg" ]; then
        print_status 0 "Python virtual environment is valid"
    else
        print_warning "Python virtual environment may be corrupted"
    fi
else
    print_warning "Python virtual environment not found (run setup script)"
fi

# Check Docker Compose configuration
echo ""
echo "🐳 Checking Docker Configuration..."

if command -v docker-compose > /dev/null 2>&1; then
    if docker-compose config --quiet > /dev/null 2>&1; then
        print_status 0 "Docker Compose configuration is valid"
    else
        print_status 1 "Docker Compose configuration has errors"
    fi
else
    print_warning "Docker Compose not available for validation"
fi

# Check environment files
echo ""
echo "🔧 Checking Environment Files..."

ENV_FILES=(".env" "backend/.env" "python-service/.env" "frontend/.env")
for env_file in "${ENV_FILES[@]}"; do
    if [ -f "$env_file" ]; then
        print_status 0 "Environment file exists: $env_file"
    else
        print_warning "Environment file missing: $env_file (copy from .env.example)"
    fi
done

# Summary
echo ""
echo "📊 Setup Verification Summary"
echo "============================"

# Count issues
MISSING_DEPS=0
if [ ! -d "node_modules" ]; then ((MISSING_DEPS++)); fi
if [ ! -d "python-service/venv" ]; then ((MISSING_DEPS++)); fi

MISSING_ENV=0
for env_file in "${ENV_FILES[@]}"; do
    if [ ! -f "$env_file" ]; then ((MISSING_ENV++)); fi
done

if [ $MISSING_DEPS -eq 0 ] && [ $MISSING_ENV -eq 0 ]; then
    echo -e "${GREEN}✅ Setup appears to be complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Start development: npm run dev"
    echo "2. Or use Docker: ./scripts/docker-start.sh"
    echo "3. Access frontend: http://localhost:3000"
else
    echo -e "${YELLOW}⚠️  Setup needs attention:${NC}"
    if [ $MISSING_DEPS -gt 0 ]; then
        echo "- Run './scripts/setup.sh' to install dependencies"
    fi
    if [ $MISSING_ENV -gt 0 ]; then
        echo "- Copy .env.example files to .env files and configure"
    fi
fi

echo ""
echo "For detailed setup instructions, see DEPLOYMENT.md"