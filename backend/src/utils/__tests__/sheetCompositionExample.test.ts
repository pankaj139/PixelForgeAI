import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  processImagesWithSheetComposition,
  getAvailableGridLayouts,
  calculateRequiredSheets,
  validateSheetCompositionOptions
} from '../sheetCompositionExample.js';
import { ProcessedImage, AspectRatio, DetectionResult } from '../../types/index.js';
import Sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Sheet Composition Example Functions', () => {
  let testOutputDir: string;
  let mockImages: ProcessedImage[];

  beforeEach(async () => {
    testOutputDir = path.join(__dirname, '../../temp/test-example-sheets');
    await fs.mkdir(testOutputDir, { recursive: true });
    mockImages = await createMockProcessedImages();
  });

  afterEach(async () => {
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('processImagesWithSheetComposition', () => {
    it('should process images and create composed sheets', async () => {
      const result = await processImagesWithSheetComposition(
        mockImages.slice(0, 3),
        '2x2',
        'portrait',
        testOutputDir
      );

      expect(result.individualImages).toHaveLength(3);
      expect(result.composedSheets).toHaveLength(1);
      expect(result.composedSheets[0].images).toHaveLength(3);
      expect(result.composedSheets[0].emptySlots).toBe(1);
      expect(result.composedSheets[0].layout.name).toBe('2x2');
      expect(result.composedSheets[0].orientation).toBe('portrait');
    });

    it('should handle multiple sheets when needed', async () => {
      const result = await processImagesWithSheetComposition(
        mockImages.slice(0, 5),
        '1x2',
        'landscape',
        testOutputDir
      );

      expect(result.individualImages).toHaveLength(5);
      expect(result.composedSheets).toHaveLength(3); // 2 + 2 + 1 images
      expect(result.composedSheets[0].images).toHaveLength(2);
      expect(result.composedSheets[1].images).toHaveLength(2);
      expect(result.composedSheets[2].images).toHaveLength(1);
    });

    it('should throw error for invalid grid layout', async () => {
      await expect(
        processImagesWithSheetComposition(
          mockImages.slice(0, 2),
          'invalid-layout',
          'portrait',
          testOutputDir
        )
      ).rejects.toThrow('Invalid grid layout: invalid-layout');
    });
  });

  describe('getAvailableGridLayouts', () => {
    it('should return all available grid layouts', () => {
      const layouts = getAvailableGridLayouts();
      
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

  describe('calculateRequiredSheets', () => {
    it('should calculate correct number of sheets for 2x2 layout', () => {
      expect(calculateRequiredSheets(1, '2x2')).toBe(1);
      expect(calculateRequiredSheets(4, '2x2')).toBe(1);
      expect(calculateRequiredSheets(5, '2x2')).toBe(2);
      expect(calculateRequiredSheets(8, '2x2')).toBe(2);
      expect(calculateRequiredSheets(9, '2x2')).toBe(3);
    });

    it('should calculate correct number of sheets for 1x2 layout', () => {
      expect(calculateRequiredSheets(1, '1x2')).toBe(1);
      expect(calculateRequiredSheets(2, '1x2')).toBe(1);
      expect(calculateRequiredSheets(3, '1x2')).toBe(2);
      expect(calculateRequiredSheets(4, '1x2')).toBe(2);
      expect(calculateRequiredSheets(5, '1x2')).toBe(3);
    });

    it('should calculate correct number of sheets for 1x3 layout', () => {
      expect(calculateRequiredSheets(1, '1x3')).toBe(1);
      expect(calculateRequiredSheets(3, '1x3')).toBe(1);
      expect(calculateRequiredSheets(4, '1x3')).toBe(2);
      expect(calculateRequiredSheets(6, '1x3')).toBe(2);
      expect(calculateRequiredSheets(7, '1x3')).toBe(3);
    });

    it('should throw error for invalid grid layout', () => {
      expect(() => calculateRequiredSheets(5, 'invalid')).toThrow('Invalid grid layout: invalid');
    });
  });

  describe('validateSheetCompositionOptions', () => {
    it('should validate correct options', () => {
      const result = validateSheetCompositionOptions(5, '2x2', 'portrait');
      expect(result.isValid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should reject zero images', () => {
      const result = validateSheetCompositionOptions(0, '2x2', 'portrait');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('At least one image is required');
    });

    it('should reject invalid grid layout', () => {
      const result = validateSheetCompositionOptions(5, 'invalid', 'portrait');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Invalid grid layout: invalid');
    });

    it('should reject invalid orientation', () => {
      const result = validateSheetCompositionOptions(5, '2x2', 'invalid' as any);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Orientation must be portrait or landscape');
    });

    it('should reject too many sheets', () => {
      const result = validateSheetCompositionOptions(1000, '1x2', 'portrait'); // Would require 500 sheets
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('Too many sheets required');
    });
  });
});

// Helper function to create mock processed images
async function createMockProcessedImages(): Promise<ProcessedImage[]> {
  const testImagesDir = path.join(__dirname, '../../temp/test-example-images');
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
    const imagePath = path.join(testImagesDir, `test-example-image-${i}.jpg`);
    
    // Create a simple test image using Sharp
    await Sharp({
      create: {
        width: 400,
        height: 600,
        channels: 3,
        background: { r: 50 + i * 30, g: 100 + i * 20, b: 150 + i * 15 }
      }
    })
    .jpeg()
    .toFile(imagePath);
    
    images.push({
      id: `example-image-${i}`,
      originalFileId: `example-original-${i}`,
      processedPath: imagePath,
      cropArea: { x: 0, y: 0, width: 400, height: 600, confidence: 1 },
      aspectRatio: mockAspectRatio,
      detections: mockDetections,
      processingTime: 150
    });
  }
  
  return images;
}