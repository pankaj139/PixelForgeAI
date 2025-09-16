#!/bin/bash

# Comprehensive Test Runner for Hybrid Architecture
# This script runs all tests for the Python service, Node.js backend, and integration tests

set -e

echo "🧪 Running Comprehensive Tests for Hybrid Architecture"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required directories exist
check_directories() {
    print_status "Checking project structure..."
    
    if [ ! -d "python-service" ]; then
        print_error "python-service directory not found"
        exit 1
    fi
    
    if [ ! -d "backend" ]; then
        print_error "backend directory not found"
        exit 1
    fi
    
    if [ ! -d "frontend" ]; then
        print_error "frontend directory not found"
        exit 1
    fi
    
    print_success "Project structure verified"
}

# Install dependencies if needed
install_dependencies() {
    print_status "Checking and installing dependencies..."
    
    # Python service dependencies
    if [ -f "python-service/requirements.txt" ]; then
        print_status "Installing Python dependencies..."
        cd python-service
        if [ ! -d "venv" ]; then
            python3 -m venv venv
        fi
        source venv/bin/activate
        pip install -r requirements.txt
        deactivate
        cd ..
        print_success "Python dependencies installed"
    fi
    
    # Backend dependencies
    if [ -f "backend/package.json" ]; then
        print_status "Installing backend dependencies..."
        cd backend
        if [ ! -d "node_modules" ]; then
            npm install
        fi
        cd ..
        print_success "Backend dependencies installed"
    fi
    
    # Frontend dependencies
    if [ -f "frontend/package.json" ]; then
        print_status "Installing frontend dependencies..."
        cd frontend
        if [ ! -d "node_modules" ]; then
            npm install
        fi
        cd ..
        print_success "Frontend dependencies installed"
    fi
}

# Run Python service tests
run_python_tests() {
    print_status "Running Python service tests..."
    
    cd python-service
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Run unit tests
    print_status "Running Python unit tests..."
    python -m pytest tests/ -v --tb=short --disable-warnings
    
    # Run performance tests
    print_status "Running Python performance tests..."
    python -m pytest tests/test_performance.py -v --tb=short --disable-warnings -s
    
    deactivate
    cd ..
    
    print_success "Python service tests completed"
}

# Run Node.js backend tests
run_backend_tests() {
    print_status "Running Node.js backend tests..."
    
    cd backend
    
    # Run unit tests
    print_status "Running backend unit tests..."
    npm run test
    
    # Run integration tests
    print_status "Running backend integration tests..."
    npm run test -- --run src/services/__tests__/pythonServiceIntegration.test.ts
    
    # Run end-to-end tests
    print_status "Running end-to-end workflow tests..."
    npm run test -- --run src/services/__tests__/endToEndWorkflow.test.ts
    
    # Run performance tests
    print_status "Running backend performance tests..."
    npm run test -- --run src/services/__tests__/performanceTests.test.ts
    
    cd ..
    
    print_success "Backend tests completed"
}

# Run frontend tests
run_frontend_tests() {
    print_status "Running frontend tests..."
    
    cd frontend
    
    # Run unit tests
    print_status "Running frontend unit tests..."
    npm run test
    
    cd ..
    
    print_success "Frontend tests completed"
}

# Generate test coverage report
generate_coverage() {
    print_status "Generating test coverage reports..."
    
    # Python coverage
    cd python-service
    source venv/bin/activate
    python -m pytest tests/ --cov=. --cov-report=html --cov-report=term
    deactivate
    cd ..
    
    # Backend coverage
    cd backend
    npm run test -- --coverage
    cd ..
    
    print_success "Coverage reports generated"
}

# Run load tests (optional)
run_load_tests() {
    if [ "$1" = "--load-tests" ]; then
        print_status "Running load tests..."
        
        # Check if Python service is running
        if ! curl -s http://localhost:8000/health > /dev/null; then
            print_warning "Python service not running, skipping load tests"
            return
        fi
        
        # Check if Node.js backend is running
        if ! curl -s http://localhost:3001/health > /dev/null; then
            print_warning "Node.js backend not running, skipping load tests"
            return
        fi
        
        print_status "Running concurrent request tests..."
        cd python-service
        source venv/bin/activate
        python -m pytest tests/test_performance.py::TestPerformance::test_concurrent_requests_performance -v -s
        deactivate
        cd ..
        
        print_success "Load tests completed"
    fi
}

# Cleanup function
cleanup() {
    print_status "Cleaning up test artifacts..."
    
    # Remove test directories
    find . -name "test-*" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # Remove temporary files
    find . -name "*.tmp" -delete 2>/dev/null || true
    find . -name "temp_*" -delete 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# Main execution
main() {
    echo "Starting comprehensive test suite..."
    echo "Test run started at: $(date)"
    
    # Parse command line arguments
    SKIP_DEPS=false
    RUN_LOAD_TESTS=false
    SKIP_CLEANUP=false
    
    for arg in "$@"; do
        case $arg in
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            --load-tests)
                RUN_LOAD_TESTS=true
                shift
                ;;
            --skip-cleanup)
                SKIP_CLEANUP=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --skip-deps     Skip dependency installation"
                echo "  --load-tests    Run load tests (requires services to be running)"
                echo "  --skip-cleanup  Skip cleanup of test artifacts"
                echo "  --help          Show this help message"
                exit 0
                ;;
        esac
    done
    
    # Set up trap for cleanup
    if [ "$SKIP_CLEANUP" = false ]; then
        trap cleanup EXIT
    fi
    
    # Run test phases
    check_directories
    
    if [ "$SKIP_DEPS" = false ]; then
        install_dependencies
    fi
    
    # Run tests in order
    run_python_tests
    run_backend_tests
    run_frontend_tests
    
    # Generate coverage reports
    generate_coverage
    
    # Run load tests if requested
    if [ "$RUN_LOAD_TESTS" = true ]; then
        run_load_tests --load-tests
    fi
    
    echo ""
    echo "=================================================="
    print_success "All tests completed successfully!"
    echo "Test run completed at: $(date)"
    
    # Summary
    echo ""
    echo "📊 Test Summary:"
    echo "✅ Python service unit tests"
    echo "✅ Python service performance tests"
    echo "✅ Node.js backend unit tests"
    echo "✅ Node.js integration tests"
    echo "✅ End-to-end workflow tests"
    echo "✅ Performance tests"
    echo "✅ Frontend tests"
    echo "✅ Coverage reports generated"
    
    if [ "$RUN_LOAD_TESTS" = true ]; then
        echo "✅ Load tests"
    fi
    
    echo ""
    echo "📁 Coverage reports available at:"
    echo "   - Python: python-service/htmlcov/index.html"
    echo "   - Backend: backend/coverage/index.html"
}

# Run main function with all arguments
main "$@"