import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SheetCompositionService, sheetCompositionService } from '../sheetCompositionService.js';
import { ProcessedImage, GridLayout, AspectRatio, DetectionResult } from '../../types/index.js';
import Sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Mock the Python service client
vi.mock('../pythonServiceClient.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    composeSheet: vi.fn().mockRejectedValue(new Error('Python service unavailable')),
    isHealthy: false
  })),
  getPythonServiceClient: vi.fn().mockReturnValue({
    composeSheet: vi.fn().mockRejectedValue(new Error('Python service unavailable')),
    isHealthy: false
  })
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SheetCompositionService', () => {
  let service: SheetCompositionService;
  let testOutputDir: string;
  let mockImages: ProcessedImage[];

  beforeEach(async () => {
    service = new SheetCompositionService();
    testOutputDir = path.join(__dirname, '../../temp/test-sheets');
    
    // Create test output directory
    await fs.mkdir(testOutputDir, { recursive: true });
    
    // Create mock processed images
    mockImages = await createMockProcessedImages();
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('composeA4Sheets', () => {
    it('should create single sheet for images that fit in one grid', async () => {
      const layout: GridLayout = { rows: 2, columns: 2, name: '2x2' };
      const images = mockImages.slice(0, 3); // 3 images in 2x2 grid
      
      const sheets = await service.composeA4Sheets(images, layout, 'portrait', testOutputDir);
      
      expect(sheets).toHaveLength(1);
      expect(sheets[0].layout).toEqual(layout);
      expect(sheets[0].orientation).toBe('portrait');
      expect(sheets[0].images).toHaveLength(3);
      expect(sheets[0].emptySlots).toBe(1);
      expect(sheets[0].id).toBeDefined();
      expect(sheets[0].createdAt).toBeInstanceOf(Date);
      
      // Verify file was created
      const fileExists = await fs.access(sheets[0].sheetPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should create multiple sheets when images exceed grid capacity', async () => {
      const layout: GridLayout = { rows: 1, columns: 2, name: '1x2' };
      const images = mockImages.slice(0, 5); // 5 images in 1x2 grid (2 per sheet)
      
      const sheets = await service.composeA4Sheets(images, layout, 'landscape', testOutputDir);
      
      expect(sheets).toHaveLength(3); // 2 + 2 + 1 images
      expect(sheets[0].images).toHaveLength(2);
      expect(sheets[0].emptySlots).toBe(0);
      expect(sheets[1].images).toHaveLength(2);
      expect(sheets[1].emptySlots).toBe(0);
      expect(sheets[2].images).toHaveLength(1);
      expect(sheets[2].emptySlots).toBe(1);
      
      // All sheets should have same layout and orientation
      sheets.forEach(sheet => {
        expect(sheet.layout).toEqual(layout);
        expect(sheet.orientation).toBe('landscape');
      });
    });

    it('should handle 1x3 layout correctly', async () => {
      const layout: GridLayout = { rows: 1, columns: 3, name: '1x3' };
      const images = mockImages.slice(0, 4); // 4 images in 1x3 grid
      
      const sheets = await service.composeA4Sheets(images, layout, 'portrait', testOutputDir);
      
      expect(sheets).toHaveLength(2);
      expect(sheets[0].images).toHaveLength(3);
      expect(sheets[0].emptySlots).toBe(0);
      expect(sheets[1].images).toHaveLength(1);
      expect(sheets[1].emptySlots).toBe(2);
    });

    it('should throw error for empty image array', async () => {
      const layout: GridLayout = { rows: 2, columns: 2, name: '2x2' };
      
      await expect(
        service.composeA4Sheets([], layout, 'portrait', testOutputDir)
      ).rejects.toThrow('No images provided for sheet composition');
    });

    it('should handle single image in large grid', async () => {
      const layout: GridLayout = { rows: 2, columns: 2, name: '2x2' };
      const images = mockImages.slice(0, 1);
      
      const sheets = await service.composeA4Sheets(images, layout, 'portrait', testOutputDir);
      
      expect(sheets).toHaveLength(1);
      expect(sheets[0].images).toHaveLength(1);
      expect(sheets[0].emptySlots).toBe(3);
    });
  });

  describe('getGridLayouts', () => {
    it('should return all predefined grid layouts', () => {
      const layouts = SheetCompositionService.getGridLayouts();
      
      expect(layouts).toHaveLength(8);
      expect(layouts).toContainEqual({ rows: 1, columns: 1, name: '1x1' });
      expect(layouts).toContainEqual({ rows: 1, columns: 2, name: '1x2' });
      expect(layouts).toContainEqual({ rows: 1, columns: 3, name: '1x3' });
      expect(layouts).toContainEqual({ rows: 1, columns: 4, name: '1x4' });
      expect(layouts).toContainEqual({ rows: 2, columns: 2, name: '2x2' });
      expect(layouts).toContainEqual({ rows: 2, columns: 3, name: '2x3' });
      expect(layouts).toContainEqual({ rows: 3, columns: 2, name: '3x2' });
      expect(layouts).toContainEqual({ rows: 3, columns: 3, name: '3x3' });
    });
  });

  describe('getGridLayoutByName', () => {
    it('should return correct layout for valid name', () => {
      const layout = SheetCompositionService.getGridLayoutByName('2x2');
      
      expect(layout).toEqual({ rows: 2, columns: 2, name: '2x2' });
    });

    it('should return undefined for invalid name', () => {
      const layout = SheetCompositionService.getGridLayoutByName('invalid');
      
      expect(layout).toBeUndefined();
    });
  });

  describe('A4 dimensions and calculations', () => {
    it('should create portrait A4 sheets with correct dimensions', async () => {
      const layout: GridLayout = { rows: 1, columns: 1, name: '1x1' };
      const images = mockImages.slice(0, 1);
      
      const sheets = await service.composeA4Sheets(images, layout, 'portrait', testOutputDir);
      
      // Verify the created image has A4 portrait dimensions
      const metadata = await Sharp(sheets[0].sheetPath).metadata();
      expect(metadata.width).toBe(2480); // A4 portrait width at 300 DPI
      expect(metadata.height).toBe(3508); // A4 portrait height at 300 DPI
    });

    it('should create landscape A4 sheets with correct dimensions', async () => {
      const layout: GridLayout = { rows: 1, columns: 1, name: '1x1' };
      const images = mockImages.slice(0, 1);
      
      const sheets = await service.composeA4Sheets(images, layout, 'landscape', testOutputDir);
      
      // Verify the created image has A4 landscape dimensions
      const metadata = await Sharp(sheets[0].sheetPath).metadata();
      expect(metadata.width).toBe(3508); // A4 landscape width at 300 DPI
      expect(metadata.height).toBe(2480); // A4 landscape height at 300 DPI
    });
  });

  describe('error handling', () => {
    it('should continue processing other images when one image fails', async () => {
      // Create a mock image with invalid path
      const invalidImage: ProcessedImage = {
        ...mockImages[0],
        processedPath: '/invalid/path/image.jpg'
      };
      
      const images = [invalidImage, ...mockImages.slice(0, 2)];
      const layout: GridLayout = { rows: 1, columns: 3, name: '1x3' };
      
      // Should not throw error, but continue with valid images
      const sheets = await service.composeA4Sheets(images, layout, 'portrait', testOutputDir);
      
      expect(sheets).toHaveLength(1);
      expect(sheets[0].images).toHaveLength(3); // All images are recorded
      
      // Verify file was still created
      const fileExists = await fs.access(sheets[0].sheetPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(sheetCompositionService).toBeInstanceOf(SheetCompositionService);
    });
  });
});

// Helper function to create mock processed images
async function createMockProcessedImages(): Promise<ProcessedImage[]> {
  const testImagesDir = path.join(__dirname, '../../temp/test-images');
  await fs.mkdir(testImagesDir, { recursive: true });
  
  const mockAspectRatio: AspectRatio = {
    width: 4,
    height: 6,
    name: '4x6'
  };
  
  const mockDetections: DetectionResult = {
    faces: [],
    people: [],
    confidence: 0
  };
  
  const images: ProcessedImage[] = [];
  
  // Create 6 test images
  for (let i = 0; i < 6; i++) {
    const imagePath = path.join(testImagesDir, `test-image-${i}.jpg`);
    
    // Create a simple test image using Sharp
    await Sharp({
      create: {
        width: 400,
        height: 600,
        channels: 3,
        background: { r: 100 + i * 20, g: 150, b: 200 }
      }
    })
    .jpeg()
    .toFile(imagePath);
    
    images.push({
      id: `image-${i}`,
      originalFileId: `original-${i}`,
      processedPath: imagePath,
      cropArea: { x: 0, y: 0, width: 400, height: 600, confidence: 1 },
      aspectRatio: mockAspectRatio,
      detections: mockDetections,
      processingTime: 100
    });
  }
  
  return images;
}