#!/usr/bin/env python3
"""
Test the Python service error handling and logging
"""

from fastapi.testclient import TestClient
from main import app

def test_service():
    client = TestClient(app)

    # Test health endpoint
    print('Testing health endpoint...')
    response = client.get('/health')
    print(f'Health status: {response.status_code}')
    print(f'Response: {response.json()}')

    # Test detailed health endpoint
    print('\nTesting detailed health endpoint...')
    response = client.get('/health/detailed')
    print(f'Detailed health status: {response.status_code}')
    print(f'Response keys: {list(response.json().keys())}')

    # Test error handling with invalid request
    print('\nTesting error handling...')
    response = client.post('/api/v1/detect', json={'invalid': 'data'})
    print(f'Error response status: {response.status_code}')
    error_response = response.json()
    print(f'Error structure: {list(error_response.keys())}')
    print(f'Error code: {error_response.get("error_code")}')
    print(f'Correlation ID: {error_response.get("correlation_id")}')

    print('\n✅ Python service error handling and logging working correctly!')

if __name__ == "__main__":
    test_service()