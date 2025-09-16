/**
 * Example usage of the Python Service Client
 * This file demonstrates how to use the PythonServiceClient to communicate with the Python FastAPI service
 */

import { 
  getPythonServiceClient, 
  PythonServiceError, 
  PythonServiceConnectionError,
  type DetectionRequest,
  type CropRequest,
  type BatchProcessRequest,
  type SheetCompositionRequest
} from '../services/pythonServiceClient';

async function exampleUsage() {
  // Get the singleton client instance
  const client = getPythonServiceClient({
    baseUrl: 'http://localhost:8000',
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000
  });

  try {
    // 1. Check service health
    console.log('Checking Python service health...');
    const health = await client.checkHealth();
    console.log('Service health:', health);

    // 2. Detect objects in an image
    console.log('\nDetecting objects in image...');
    const detectionRequest: DetectionRequest = {
      image_path: '/uploads/sample-image.jpg',
      detection_types: ['face', 'person'],
      confidence_threshold: 0.7
    };

    const detections = await client.detectObjects(detectionRequest);
    console.log('Detected objects:', detections);

    // 3. Crop image based on detections
    console.log('\nCropping image...');
    const cropRequest: CropRequest = {
      image_path: '/uploads/sample-image.jpg',
      target_aspect_ratio: { width: 4, height: 6 },
      detection_results: detections,
      crop_strategy: 'center_faces'
    };

    const croppedImage = await client.cropImage(cropRequest);
    console.log('Cropped image:', croppedImage);

    // 4. Process multiple images in batch
    console.log('\nProcessing batch of images...');
    const batchRequest: BatchProcessRequest = {
      images: ['/uploads/image1.jpg', '/uploads/image2.jpg', '/uploads/image3.jpg'],
      processing_options: {
        target_aspect_ratio: { width: 4, height: 6 },
        crop_strategy: 'center',
        detection_types: ['face', 'person']
      }
    };

    const batchResult = await client.processBatch(batchRequest);
    console.log('Batch processing result:', batchResult);

    // 5. Compose images into a sheet
    console.log('\nComposing sheet...');
    const sheetRequest: SheetCompositionRequest = {
      processed_images: batchResult.processed_images.map(img => img.processed_path),
      grid_layout: { rows: 2, columns: 2 },
      sheet_orientation: 'portrait',
      output_format: 'pdf'
    };

    const composedSheet = await client.composeSheet(sheetRequest);
    console.log('Composed sheet:', composedSheet);

  } catch (error) {
    if (error instanceof PythonServiceConnectionError) {
      console.error('Failed to connect to Python service:', error.message);
      console.error('Make sure the Python service is running on the configured URL');
    } else if (error instanceof PythonServiceError) {
      console.error('Python service error:', error.message);
      console.error('Status code:', error.statusCode);
      console.error('Error code:', error.errorCode);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// Example of using the client in an Express route
export function createImageProcessingRoute() {
  return async (req: any, res: any) => {
    const client = getPythonServiceClient();
    
    try {
      // Check if service is healthy before processing
      if (!client.getHealthStatus()) {
        return res.status(503).json({
          error: 'Python service is currently unavailable'
        });
      }

      const { imagePath, targetAspectRatio } = req.body;

      // Detect objects first
      const detections = await client.detectObjects({
        image_path: imagePath,
        detection_types: ['face', 'person']
      });

      // Crop image based on detections
      const result = await client.cropImage({
        image_path: imagePath,
        target_aspect_ratio: targetAspectRatio,
        detection_results: detections,
        crop_strategy: detections.length > 0 ? 'center_faces' : 'center'
      });

      res.json({
        success: true,
        result,
        detections
      });

    } catch (error) {
      if (error instanceof PythonServiceError) {
        res.status(error.statusCode).json({
          error: error.message,
          errorCode: error.errorCode
        });
      } else {
        res.status(500).json({
          error: 'Internal server error'
        });
      }
    }
  };
}

// Run example if this file is executed directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}