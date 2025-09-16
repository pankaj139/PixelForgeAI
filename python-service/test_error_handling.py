#!/usr/bin/env python3
"""
Simple test script to verify error handling and logging implementation
"""

import asyncio
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.logging_config import setup_logging, get_logger, set_correlation_id
from utils.error_handling import (
    create_error_response, ServiceException, ImageNotFoundException,
    InvalidInputException, ProcessingFailedException
)
from utils.health_monitor import get_health_monitor

def test_logging():
    """Test logging functionality"""
    print("Testing logging functionality...")
    
    # Setup logging
    setup_logging(debug=True)
    logger = get_logger(__name__)
    
    # Test correlation ID
    set_correlation_id("test-correlation-123")
    
    # Test different log levels
    logger.info("This is an info message", {"test_field": "test_value"})
    logger.warning("This is a warning message")
    logger.error("This is an error message", {"error_code": "TEST_ERROR"})
    
    print("✓ Logging test completed")

def test_error_handling():
    """Test error handling functionality"""
    print("Testing error handling functionality...")
    
    # Test error response creation
    error_response = create_error_response(
        error_code="TEST_ERROR",
        message="This is a test error",
        status_code=500,
        details={"test": True},
        correlation_id="test-correlation-123"
    )
    
    assert error_response.error_code == "TEST_ERROR"
    assert error_response.message == "This is a test error"
    assert error_response.correlation_id == "test-correlation-123"
    assert error_response.service == "python-image-processing-service"
    
    # Test custom exceptions
    try:
        raise ImageNotFoundException("/path/to/missing/image.jpg")
    except ServiceException as e:
        assert e.error_code == "IMAGE_NOT_FOUND"
        assert e.status_code == 404
    
    try:
        raise InvalidInputException("Invalid input provided")
    except ServiceException as e:
        assert e.error_code == "INVALID_INPUT"
        assert e.status_code == 400
    
    try:
        raise ProcessingFailedException("Image processing")
    except ServiceException as e:
        assert e.error_code == "PROCESSING_FAILED"
        assert e.status_code == 500
    
    print("✓ Error handling test completed")

def test_health_monitoring():
    """Test health monitoring functionality"""
    print("Testing health monitoring functionality...")
    
    health_monitor = get_health_monitor()
    
    # Test basic functionality
    uptime = health_monitor.get_uptime_seconds()
    assert uptime >= 0
    
    memory_usage = health_monitor.get_memory_usage_mb()
    assert memory_usage > 0
    
    disk_usage = health_monitor.get_disk_usage_percent()
    assert 0 <= disk_usage <= 100
    
    # Test health status
    health_status = health_monitor.get_health_status()
    assert health_status.status in ["healthy", "unhealthy", "degraded"]
    assert isinstance(health_status.checks, dict)
    assert health_status.uptime_seconds >= 0
    
    # Test metrics
    metrics = health_monitor.get_metrics()
    assert "uptime_seconds" in metrics
    assert "memory_usage_mb" in metrics
    assert "disk_usage_percent" in metrics
    
    print("✓ Health monitoring test completed")

def main():
    """Run all tests"""
    print("Starting error handling and logging tests...\n")
    
    try:
        test_logging()
        test_error_handling()
        test_health_monitoring()
        
        print("\n✅ All tests passed successfully!")
        return 0
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)