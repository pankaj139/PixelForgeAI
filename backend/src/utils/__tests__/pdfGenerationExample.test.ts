import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  generatePDFFromImages, 
  generateHighResolutionPDFFromImages,
  generateMixedOrientationPDF 
} from '../pdfGenerationExample.js';
import { ProcessedImage, AspectRatio, DetectionResult } from '../../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock the services
vi.mock('../../services/sheetCompositionService.js', async () => {
  const actual = await vi.importActual('../../services/sheetCompositionService.js');
  return {
    ...actual,
    SheetCompositionService: {
      getGridLayoutByName: vi.fn()
    },
    sheetCompositionService: {
      composeA4Sheets: vi.fn()
    }
  };
});

vi.mock('../../services/pdfGenerationService.js', () => ({
  pdfGenerationService: {
    generatePDF: vi.fn(),
    generateHighResolutionPDF: vi.fn(),
    validateSheetFiles: vi.fn(),
    getPDFStats: vi.fn()
  }
}));

describe('PDF Generation Example Functions', () => {
  let testOutputDir: string;
  let mockProcessedImages: ProcessedImage[];

  beforeEach(async () => {
    testOutputDir = path.join(__dirname, '../../temp/test-pdf-examples');
    await fs.mkdir(testOutputDir, { recursive: true });

    // Create mock processed images
    const aspectRatio: AspectRatio = { width: 4, height: 6, name: '4x6', orientation: 'portrait' };
    const detections: DetectionResult = { faces: [], people: [], confidence: 0 };

    mockProcessedImages = [
      {
        id: 'img-1',
        originalFileId: 'file-1',
        processedPath: path.join(testOutputDir, 'processed1.jpg'),
        cropArea: { x: 0, y: 0, width: 100, height: 100, confidence: 0.9 },
        aspectRatio,
        detections,
        processingTime: 100
      },
      {
        id: 'img-2',
        originalFileId: 'file-2',
        processedPath: path.join(testOutputDir, 'processed2.jpg'),
        cropArea: { x: 0, y: 0, width: 100, height: 100, confidence: 0.9 },
        aspectRatio,
        detections,
        processingTime: 120
      },
      {
        id: 'img-3',
        originalFileId: 'file-3',
        processedPath: path.join(testOutputDir, 'processed3.jpg'),
        cropArea: { x: 0, y: 0, width: 100, height: 100, confidence: 0.9 },
        aspectRatio,
        detections,
        processingTime: 90
      }
    ];

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('generatePDFFromImages', () => {
    it('should generate PDF from processed images successfully', async () => {
      // Mock the services
      const { sheetCompositionService } = await import('../../services/sheetCompositionService.js');
      const { pdfGenerationService } = await import('../../services/pdfGenerationService.js');

      const mockSheets = [
        {
          id: 'sheet-1',
          sheetPath: path.join(testOutputDir, 'sheet1.jpg'),
          layout: { rows: 2, columns: 2, name: '2x2' },
          orientation: 'portrait' as const,
          images: mockProcessedImages.slice(0, 2),
          emptySlots: 2,
          createdAt: new Date()
        }
      ];

      (sheetCompositionService.constructor.getGridLayoutByName as any).mockReturnValue({
        rows: 2,
        columns: 2,
        name: '2x2'
      });
      (sheetCompositionService.composeA4Sheets as any).mockResolvedValue(mockSheets);
      (pdfGenerationService.generatePDF as any).mockResolvedValue('/tmp/output.pdf');
      (pdfGenerationService.getPDFStats as any).mockReturnValue({
        totalSheets: 1,
        totalImages: 2,
        orientations: { portrait: 1, landscape: 0 },
        layouts: { '2x2': 1 }
      });

      const result = await generatePDFFromImages(
        mockProcessedImages.slice(0, 2),
        '2x2',
        'portrait',
        testOutputDir
      );

      expect(result.pdfPath).toBe('/tmp/output.pdf');
      expect(result.sheetsCreated).toBe(1);
      expect(result.totalImages).toBe(2);
      expect(sheetCompositionService.composeA4Sheets).toHaveBeenCalledWith(
        mockProcessedImages.slice(0, 2),
        { rows: 2, columns: 2, name: '2x2' },
        'portrait',
        testOutputDir
      );
    });

    it('should throw error for invalid grid layout', async () => {
      const { sheetCompositionService } = await import('../../services/sheetCompositionService.js');
      (sheetCompositionService.constructor.getGridLayoutByName as any).mockReturnValue(null);

      await expect(generatePDFFromImages(
        mockProcessedImages,
        'invalid-layout',
        'portrait',
        testOutputDir
      )).rejects.toThrow('Invalid grid layout: invalid-layout');
    });

    it('should use default parameters when not provided', async () => {
      const { sheetCompositionService } = await import('../../services/sheetCompositionService.js');
      const { pdfGenerationService } = await import('../../services/pdfGenerationService.js');

      (sheetCompositionService.constructor.getGridLayoutByName as any).mockReturnValue({
        rows: 2,
        columns: 2,
        name: '2x2'
      });
      (sheetCompositionService.composeA4Sheets as any).mockResolvedValue([]);
      (pdfGenerationService.generatePDF as any).mockResolvedValue('/tmp/output.pdf');
      (pdfGenerationService.getPDFStats as any).mockReturnValue({
        totalSheets: 0,
        totalImages: 0,
        orientations: { portrait: 0, landscape: 0 },
        layouts: {}
      });

      const result = await generatePDFFromImages(mockProcessedImages);

      expect(result.pdfPath).toBe('/tmp/output.pdf');
      expect(sheetCompositionService.composeA4Sheets).toHaveBeenCalledWith(
        mockProcessedImages,
        { rows: 2, columns: 2, name: '2x2' },
        'portrait',
        expect.stringContaining('pdf-output')
      );
    });
  });

  describe('generateHighResolutionPDFFromImages', () => {
    it('should generate high-resolution PDF successfully', async () => {
      const { sheetCompositionService } = await import('../../services/sheetCompositionService.js');
      const { pdfGenerationService } = await import('../../services/pdfGenerationService.js');

      const mockSheets = [
        {
          id: 'sheet-1',
          sheetPath: path.join(testOutputDir, 'sheet1.jpg'),
          layout: { rows: 2, columns: 2, name: '2x2' },
          orientation: 'portrait' as const,
          images: mockProcessedImages,
          emptySlots: 1,
          createdAt: new Date()
        }
      ];

      (sheetCompositionService.constructor.getGridLayoutByName as any).mockReturnValue({
        rows: 2,
        columns: 2,
        name: '2x2'
      });
      (sheetCompositionService.composeA4Sheets as any).mockResolvedValue(mockSheets);
      (pdfGenerationService.validateSheetFiles as any).mockReturnValue({
        isValid: true,
        missingFiles: []
      });
      (pdfGenerationService.generateHighResolutionPDF as any).mockResolvedValue('/tmp/high-res.pdf');

      const result = await generateHighResolutionPDFFromImages(
        mockProcessedImages,
        '2x2',
        'portrait',
        testOutputDir
      );

      expect(result.pdfPath).toBe('/tmp/high-res.pdf');
      expect(result.sheetsCreated).toBe(1);
      expect(result.totalImages).toBe(3);
      expect(pdfGenerationService.validateSheetFiles).toHaveBeenCalledWith(mockSheets);
      expect(pdfGenerationService.generateHighResolutionPDF).toHaveBeenCalled();
    });

    it('should throw error when sheet files are missing', async () => {
      const { sheetCompositionService } = await import('../../services/sheetCompositionService.js');
      const { pdfGenerationService } = await import('../../services/pdfGenerationService.js');

      (sheetCompositionService.constructor.getGridLayoutByName as any).mockReturnValue({
        rows: 2,
        columns: 2,
        name: '2x2'
      });
      (sheetCompositionService.composeA4Sheets as any).mockResolvedValue([]);
      (pdfGenerationService.validateSheetFiles as any).mockReturnValue({
        isValid: false,
        missingFiles: ['/tmp/missing1.jpg', '/tmp/missing2.jpg']
      });

      await expect(generateHighResolutionPDFFromImages(
        mockProcessedImages,
        '2x2',
        'portrait',
        testOutputDir
      )).rejects.toThrow('Missing sheet files: /tmp/missing1.jpg, /tmp/missing2.jpg');
    });
  });

  describe('generateMixedOrientationPDF', () => {
    it('should generate PDF with mixed orientations successfully', async () => {
      const { sheetCompositionService } = await import('../../services/sheetCompositionService.js');
      const { pdfGenerationService } = await import('../../services/pdfGenerationService.js');

      const portraitSheets = [
        {
          id: 'sheet-1',
          sheetPath: path.join(testOutputDir, 'portrait1.jpg'),
          layout: { rows: 2, columns: 2, name: '2x2' },
          orientation: 'portrait' as const,
          images: mockProcessedImages.slice(0, 2),
          emptySlots: 2,
          createdAt: new Date()
        }
      ];

      const landscapeSheets = [
        {
          id: 'sheet-2',
          sheetPath: path.join(testOutputDir, 'landscape1.jpg'),
          layout: { rows: 2, columns: 2, name: '2x2' },
          orientation: 'landscape' as const,
          images: mockProcessedImages.slice(2),
          emptySlots: 3,
          createdAt: new Date()
        }
      ];

      (sheetCompositionService.constructor.getGridLayoutByName as any).mockReturnValue({
        rows: 2,
        columns: 2,
        name: '2x2'
      });
      (sheetCompositionService.composeA4Sheets as any)
        .mockResolvedValueOnce(portraitSheets)
        .mockResolvedValueOnce(landscapeSheets);
      (pdfGenerationService.generatePDF as any).mockResolvedValue('/tmp/mixed.pdf');

      const result = await generateMixedOrientationPDF(mockProcessedImages, testOutputDir);

      expect(result.pdfPath).toBe('/tmp/mixed.pdf');
      expect(result.sheetsCreated).toBe(2);
      expect(result.totalImages).toBe(3);
      expect(sheetCompositionService.composeA4Sheets).toHaveBeenCalledTimes(2);
      expect(pdfGenerationService.generatePDF).toHaveBeenCalledWith(
        [...portraitSheets, ...landscapeSheets],
        testOutputDir,
        expect.objectContaining({
          sheetComposition: expect.objectContaining({
            orientation: 'portrait'
          })
        })
      );
    });

    it('should handle empty images array', async () => {
      const { sheetCompositionService } = await import('../../services/sheetCompositionService.js');
      const { pdfGenerationService } = await import('../../services/pdfGenerationService.js');

      (sheetCompositionService.constructor.getGridLayoutByName as any).mockReturnValue({
        rows: 2,
        columns: 2,
        name: '2x2'
      });
      (sheetCompositionService.composeA4Sheets as any).mockResolvedValue([]);
      (pdfGenerationService.generatePDF as any).mockResolvedValue('/tmp/empty.pdf');

      const result = await generateMixedOrientationPDF([], testOutputDir);

      expect(result.pdfPath).toBe('/tmp/empty.pdf');
      expect(result.sheetsCreated).toBe(0);
      expect(result.totalImages).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle sheet composition service errors', async () => {
      const { sheetCompositionService } = await import('../../services/sheetCompositionService.js');

      (sheetCompositionService.constructor.getGridLayoutByName as any).mockReturnValue({
        rows: 2,
        columns: 2,
        name: '2x2'
      });
      (sheetCompositionService.composeA4Sheets as any).mockRejectedValue(
        new Error('Sheet composition failed')
      );

      await expect(generatePDFFromImages(
        mockProcessedImages,
        '2x2',
        'portrait',
        testOutputDir
      )).rejects.toThrow('Sheet composition failed');
    });

    it('should handle PDF generation service errors', async () => {
      const { sheetCompositionService } = await import('../../services/sheetCompositionService.js');
      const { pdfGenerationService } = await import('../../services/pdfGenerationService.js');

      (sheetCompositionService.constructor.getGridLayoutByName as any).mockReturnValue({
        rows: 2,
        columns: 2,
        name: '2x2'
      });
      (sheetCompositionService.composeA4Sheets as any).mockResolvedValue([]);
      (pdfGenerationService.generatePDF as any).mockRejectedValue(
        new Error('PDF generation failed')
      );
      (pdfGenerationService.getPDFStats as any).mockReturnValue({
        totalSheets: 0,
        totalImages: 0,
        orientations: { portrait: 0, landscape: 0 },
        layouts: {}
      });

      await expect(generatePDFFromImages(
        mockProcessedImages,
        '2x2',
        'portrait',
        testOutputDir
      )).rejects.toThrow('PDF generation failed');
    });
  });
});