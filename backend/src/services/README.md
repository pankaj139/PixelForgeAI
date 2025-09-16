# Python Service Client

The Python Service Client provides a robust HTTP client for communicating with the Python FastAPI image processing service. It includes connection pooling, retry logic with exponential backoff, comprehensive error handling, and health monitoring.

## Features

- **Connection Pooling**: Efficient HTTP connection management with configurable pool size
- **Retry Logic**: Exponential backoff retry mechanism for failed requests
- **Error Handling**: Custom error types for different failure scenarios
- **Health Monitoring**: Automatic health checks with configurable intervals
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Singleton Pattern**: Global instance management with factory function

## Quick Start

```typescript
import { getPythonServiceClient } from './services/pythonServiceClient';

// Get the singleton client instance
const client = getPythonServiceClient({
  baseUrl: 'http://localhost:8000',
  timeout: 30000,
  maxRetries: 3
});

// Detect objects in an image
const detections = await client.detectObjects({
  image_path: '/uploads/image.jpg',
  detection_types: ['face', 'person']
});

// Crop image based on detections
const result = await client.cropImage({
  image_path: '/uploads/image.jpg',
  target_aspect_ratio: { width: 4, height: 6 },
  detection_results: detections,
  crop_strategy: 'center_faces'
});
```

## Configuration

The client accepts the following configuration options:

```typescript
interface PythonServiceConfig {
  baseUrl: string;              // Python service URL (default: http://localhost:8000)
  timeout: number;              // Request timeout in ms (default: 30000)
  maxRetries: number;           // Maximum retry attempts (default: 3)
  retryDelay: number;           // Base retry delay in ms (default: 1000)
  maxConnections: number;       // HTTP connection pool size (default: 10)
  healthCheckInterval: number;  // Health check interval in ms (default: 60000)
}
```

### Environment Variables

The client can be configured using environment variables:

- `PYTHON_SERVICE_URL`: Base URL for the Python service
- `PYTHON_SERVICE_TIMEOUT`: Request timeout in milliseconds
- `PYTHON_SERVICE_MAX_RETRIES`: Maximum number of retry attempts
- `PYTHON_SERVICE_RETRY_DELAY`: Base retry delay in milliseconds
- `PYTHON_SERVICE_MAX_CONNECTIONS`: Maximum HTTP connections
- `HEALTH_CHECK_INTERVAL`: Health check interval in milliseconds

## API Methods

### Object Detection

```typescript
const detections = await client.detectObjects({
  image_path: '/path/to/image.jpg',
  detection_types: ['face', 'person'],
  confidence_threshold: 0.7  // optional
});
```

### Image Cropping

```typescript
const result = await client.cropImage({
  image_path: '/path/to/image.jpg',
  target_aspect_ratio: { width: 4, height: 6 },
  detection_results: detections,  // optional
  crop_strategy: 'center_faces'   // optional
});
```

### Batch Processing

```typescript
const result = await client.processBatch({
  images: ['/path/to/image1.jpg', '/path/to/image2.jpg'],
  processing_options: {
    target_aspect_ratio: { width: 4, height: 6 },
    crop_strategy: 'center',
    detection_types: ['face']
  }
});
```

### Sheet Composition

```typescript
const sheet = await client.composeSheet({
  processed_images: ['/path/to/processed1.jpg', '/path/to/processed2.jpg'],
  grid_layout: { rows: 2, columns: 2 },
  sheet_orientation: 'portrait',
  output_format: 'pdf'
});
```

### Health Check

```typescript
const health = await client.checkHealth();
const isHealthy = client.getHealthStatus();
```

## Error Handling

The client provides specific error types for different failure scenarios:

### PythonServiceConnectionError

Thrown when the client cannot connect to the Python service:

```typescript
try {
  await client.detectObjects(request);
} catch (error) {
  if (error instanceof PythonServiceConnectionError) {
    console.error('Service unavailable:', error.message);
    // Handle service unavailability
  }
}
```

### PythonServiceTimeoutError

Thrown when requests exceed the configured timeout:

```typescript
try {
  await client.processBatch(largeRequest);
} catch (error) {
  if (error instanceof PythonServiceTimeoutError) {
    console.error('Request timed out:', error.message);
    // Handle timeout
  }
}
```

### PythonServiceError

Base error class for all Python service errors:

```typescript
try {
  await client.cropImage(request);
} catch (error) {
  if (error instanceof PythonServiceError) {
    console.error('Service error:', error.message);
    console.error('Status code:', error.statusCode);
    console.error('Error code:', error.errorCode);
  }
}
```

## Retry Logic

The client automatically retries failed requests with exponential backoff:

- **Retryable errors**: Connection errors, timeouts, 5xx HTTP errors
- **Non-retryable errors**: 4xx HTTP errors (except 408 timeout)
- **Backoff formula**: `retryDelay * 2^(attempt - 1)`

Example retry sequence with `retryDelay: 1000` and `maxRetries: 3`:
1. Initial attempt fails
2. Wait 1000ms, retry (attempt 1)
3. Wait 2000ms, retry (attempt 2)  
4. Wait 4000ms, retry (attempt 3)
5. If still failing, throw final error

## Health Monitoring

The client continuously monitors the Python service health:

```typescript
// Check current health status
if (client.getHealthStatus()) {
  // Service is healthy, proceed with requests
  await client.detectObjects(request);
} else {
  // Service is unhealthy, handle gracefully
  throw new Error('Python service is currently unavailable');
}
```

Health checks run automatically in the background at the configured interval. When the service becomes unavailable, the client will:

1. Mark the service as unhealthy
2. Continue attempting health checks
3. Automatically mark as healthy when service recovers

## Connection Pooling

The client uses HTTP connection pooling for optimal performance:

- **Keep-alive connections**: Reuse connections for multiple requests
- **Configurable pool size**: Control maximum concurrent connections
- **Automatic cleanup**: Connections are managed automatically

## Singleton Pattern

The client uses a singleton pattern for global instance management:

```typescript
// Get the same instance everywhere
const client1 = getPythonServiceClient();
const client2 = getPythonServiceClient();
// client1 === client2

// Reset singleton (useful for testing)
resetPythonServiceClient();
const newClient = getPythonServiceClient(); // Creates new instance
```

## Testing

The client includes comprehensive test coverage:

```bash
npm test -- src/services/__tests__/pythonServiceClient.test.ts
```

Test categories:
- Configuration and initialization
- Error handling and custom error types
- Retry logic with exponential backoff
- API method functionality
- Health check monitoring
- Singleton pattern behavior
- Resource management

## Best Practices

1. **Use the singleton**: Always use `getPythonServiceClient()` instead of creating new instances
2. **Handle errors gracefully**: Implement proper error handling for different error types
3. **Check health status**: Verify service health before critical operations
4. **Configure timeouts**: Set appropriate timeouts based on your use case
5. **Monitor logs**: The client logs all requests and errors for debugging
6. **Environment-specific config**: Use environment variables for different deployment environments

## Integration Example

```typescript
import express from 'express';
import { getPythonServiceClient, PythonServiceError } from './services/pythonServiceClient';

const app = express();
const pythonClient = getPythonServiceClient();

app.post('/api/process-image', async (req, res) => {
  try {
    // Check service health first
    if (!pythonClient.getHealthStatus()) {
      return res.status(503).json({ 
        error: 'Image processing service temporarily unavailable' 
      });
    }

    const { imagePath, aspectRatio } = req.body;

    // Process image with Python service
    const detections = await pythonClient.detectObjects({
      image_path: imagePath,
      detection_types: ['face', 'person']
    });

    const result = await pythonClient.cropImage({
      image_path: imagePath,
      target_aspect_ratio: aspectRatio,
      detection_results: detections,
      crop_strategy: 'center_faces'
    });

    res.json({ success: true, result, detections });

  } catch (error) {
    if (error instanceof PythonServiceError) {
      res.status(error.statusCode).json({
        error: error.message,
        errorCode: error.errorCode
      });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});
```