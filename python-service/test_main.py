"""
Basic tests for the FastAPI application
"""

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_root_endpoint():
    """Test the root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Image Processing Service"
    assert data["version"] == "1.0.0"
    assert "docs" in data
    assert "health" in data

def test_health_check():
    """Test the health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "image-processing-service"
    assert data["version"] == "1.0.0"
    assert "timestamp" in data
    assert "environment" in data

def test_docs_endpoint():
    """Test that the docs endpoint is accessible"""
    response = client.get("/docs")
    assert response.status_code == 200

def test_openapi_schema():
    """Test that the OpenAPI schema is accessible"""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "Image Processing Service"
    assert schema["info"]["version"] == "1.0.0"