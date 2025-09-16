import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import { PDFGenerationService } from '../pdfGenerationService.js';
import { ComposedSheet, GridLayout, ProcessingOptions, AspectRatio } from '../../types/index.js';

// Mock PDFKit
vi.mock('pdfkit', () => ({
  default: vi.fn().mockImplementation(() => ({
    info: {},
    pipe: vi.fn(),
    addPage: vi.fn(),
    image: vi.fn(),
    rect: vi.fn().mockReturnThis(),
    fill: vi.fn().mockReturnThis(),
    fontSize: vi.fn().mockReturnThis(),
    fillColor: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    end: vi.fn()
  }))
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    createWriteStream: vi.fn()
  }
}));

describe('PDFGenerationService', () => {
  let pdfService: PDFGenerationService;
  let mockWriteStream: any;
  let testOutputDir: string;
  let mockSheets: ComposedSheet[];

  beforeEach(() => {
    pdfService = new PDFGenerationService();
    testOutputDir = '/tmp/test-pdf-output';
    
    // Mock write stream
    mockWriteStream = {
      on: vi.fn((event: string, callback: Function) => {
        if (event === 'finish') {
          // Simulate immediate finish for tests
          setTimeout(callback, 0);
        }
      })
    };
    
    (fs.createWriteStream as any).mockReturnValue(mockWriteStream);
    (fs.existsSync as any).mockReturnValue(true);

    // Create mock sheets
    const mockGridLayout: GridLayout = {
      rows: 2,
      columns: 2,
      name: '2x2'
    };

    mockSheets = [
      {
        id: 'sheet-1',
        sheetPath: '/tmp/sheet1.jpg',
        layout: mockGridLayout,
        orientation: 'portrait',
        images: [
          {
            id: 'img-1',
            originalFileId: 'file-1',
            processedPath: '/tmp/processed1.jpg',
            cropArea: { x: 0, y: 0, width: 100, height: 100, confidence: 0.9 },
            aspectRatio: { width: 4, height: 6, name: '4x6' },
            detections: { faces: [], people: [], confidence: 0 },
            processingTime: 100
          },
          {
            id: 'img-2',
            originalFileId: 'file-2',
            processedPath: '/tmp/processed2.jpg',
            cropArea: { x: 0, y: 0, width: 100, height: 100, confidence: 0.9 },
            aspectRatio: { width: 4, height: 6, name: '4x6' },
            detections: { faces: [], people: [], confidence: 0 },
            processingTime: 120
          }
        ],
        emptySlots: 2,
        createdAt: new Date()
      },
      {
        id: 'sheet-2',
        sheetPath: '/tmp/sheet2.jpg',
        layout: mockGridLayout,
        orientation: 'landscape',
        images: [
          {
            id: 'img-3',
            originalFileId: 'file-3',
            processedPath: '/tmp/processed3.jpg',
            cropArea: { x: 0, y: 0, width: 100, height: 100, confidence: 0.9 },
            aspectRatio: { width: 4, height: 6, name: '4x6' },
            detections: { faces: [], people: [], confidence: 0 },
            processingTime: 90
          }
        ],
        emptySlots: 3,
        createdAt: new Date()
      }
    ];

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('generatePDF', () => {
    it('should generate PDF with single sheet', async () => {
      const singleSheet = [mockSheets[0]];
      
      const pdfPath = await pdfService.generatePDF(singleSheet, testOutputDir);
      
      expect(pdfPath).toContain(testOutputDir);
      expect(pdfPath).toMatch(/composed_sheets_.*\.pdf$/);
    });

    it('should throw error when no sheets provided', async () => {
      await expect(pdfService.generatePDF([], testOutputDir))
        .rejects.toThrow('No sheets provided for PDF generation');
    });

    it('should handle missing sheet files gracefully', async () => {
      (fs.existsSync as any).mockReturnValue(false);
      
      const pdfPath = await pdfService.generatePDF(mockSheets, testOutputDir);
      
      expect(pdfPath).toContain(testOutputDir);
    });
  });

  describe('generateHighResolutionPDF', () => {
    it('should generate high-resolution PDF', async () => {
      const pdfPath = await pdfService.generateHighResolutionPDF(mockSheets, testOutputDir);
      
      expect(pdfPath).toContain(testOutputDir);
      expect(pdfPath).toMatch(/high_res_sheets_.*\.pdf$/);
    });

    it('should throw error when no sheets provided for high-resolution PDF', async () => {
      await expect(pdfService.generateHighResolutionPDF([], testOutputDir))
        .rejects.toThrow('No sheets provided for high-resolution PDF generation');
    });
  });

  describe('validateSheetFiles', () => {
    it('should return valid when all files exist', () => {
      (fs.existsSync as any).mockReturnValue(true);
      
      const result = pdfService.validateSheetFiles(mockSheets);
      
      expect(result.isValid).toBe(true);
      expect(result.missingFiles).toHaveLength(0);
    });

    it('should return invalid when some files are missing', () => {
      (fs.existsSync as any).mockImplementation((filePath: string) => {
        return !filePath.includes('sheet2.jpg');
      });
      
      const result = pdfService.validateSheetFiles(mockSheets);
      
      expect(result.isValid).toBe(false);
      expect(result.missingFiles).toContain('/tmp/sheet2.jpg');
    });

    it('should return all missing files', () => {
      (fs.existsSync as any).mockReturnValue(false);
      
      const result = pdfService.validateSheetFiles(mockSheets);
      
      expect(result.isValid).toBe(false);
      expect(result.missingFiles).toHaveLength(2);
      expect(result.missingFiles).toContain('/tmp/sheet1.jpg');
      expect(result.missingFiles).toContain('/tmp/sheet2.jpg');
    });
  });

  describe('getPDFStats', () => {
    it('should calculate correct statistics', () => {
      const stats = pdfService.getPDFStats(mockSheets);
      
      expect(stats).toEqual({
        totalSheets: 2,
        totalImages: 3,
        orientations: { portrait: 1, landscape: 1 },
        layouts: { '2x2': 2 }
      });
    });

    it('should handle empty sheets array', () => {
      const stats = pdfService.getPDFStats([]);
      
      expect(stats).toEqual({
        totalSheets: 0,
        totalImages: 0,
        orientations: { portrait: 0, landscape: 0 },
        layouts: {}
      });
    });

    it('should count multiple layout types', () => {
      const mixedSheets = [
        { ...mockSheets[0], layout: { rows: 1, columns: 2, name: '1x2' } },
        { ...mockSheets[1], layout: { rows: 1, columns: 3, name: '1x3' } },
        { ...mockSheets[0], layout: { rows: 1, columns: 2, name: '1x2' } }
      ];
      
      const stats = pdfService.getPDFStats(mixedSheets);
      
      expect(stats.layouts).toEqual({
        '1x2': 2,
        '1x3': 1
      });
    });
  });

  describe('metadata handling', () => {
    it('should handle processing options metadata', async () => {
      const aspectRatio: AspectRatio = { width: 4, height: 6, name: '4x6' };
      const processingOptions: ProcessingOptions = {
        aspectRatio,
        faceDetectionEnabled: true,
        sheetComposition: {
          enabled: true,
          gridLayout: { rows: 2, columns: 2, name: '2x2' },
          orientation: 'portrait',
          generatePDF: true
        }
      };
      
      const pdfPath = await pdfService.generatePDF(mockSheets, testOutputDir, processingOptions);
      
      expect(pdfPath).toContain(testOutputDir);
    });
  });

  describe('error scenarios', () => {
    it('should handle write stream errors', async () => {
      mockWriteStream.on = vi.fn((event: string, callback: Function) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Write error')), 0);
        }
      });
      
      await expect(pdfService.generatePDF(mockSheets, testOutputDir))
        .rejects.toThrow('Write error');
    });

    it('should handle large number of sheets', async () => {
      const manySheets = Array.from({ length: 10 }, (_, i) => ({
        ...mockSheets[0],
        id: `sheet-${i}`,
        sheetPath: `/tmp/sheet${i}.jpg`
      }));
      
      const pdfPath = await pdfService.generatePDF(manySheets, testOutputDir);
      
      expect(pdfPath).toContain(testOutputDir);
    });

    it('should handle mixed orientations', () => {
      const mixedOrientationSheets = [
        { ...mockSheets[0], orientation: 'portrait' as const },
        { ...mockSheets[1], orientation: 'landscape' as const },
        { ...mockSheets[0], orientation: 'portrait' as const }
      ];
      
      const stats = pdfService.getPDFStats(mixedOrientationSheets);
      
      expect(stats.orientations).toEqual({ portrait: 2, landscape: 1 });
    });
  });
});