import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImageProcessingService } from '../imageProcessingService.js';
import { AspectRatio, CropArea } from '../../types/index.js';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

// Mock sharp
vi.mock('sharp');

describe('ImageProcessingService', () => {
    let service: ImageProcessingService;
    let mockSharpInstance: any;
    let testImagePath: string;
    let testOutputPath: string;

    beforeEach(() => {
        service = new ImageProcessingService();

        // Create mock sharp instance
        mockSharpInstance = {
            metadata: vi.fn(),
            extract: vi.fn(),
            resize: vi.fn(),
            sharpen: vi.fn(),
            median: vi.fn(),
            jpeg: vi.fn(),
            toFile: vi.fn(),
            stats: vi.fn()
        };

        // Chain methods return the instance for fluent API
        mockSharpInstance.extract.mockReturnValue(mockSharpInstance);
        mockSharpInstance.resize.mockReturnValue(mockSharpInstance);
        mockSharpInstance.sharpen.mockReturnValue(mockSharpInstance);
        mockSharpInstance.median.mockReturnValue(mockSharpInstance);
        mockSharpInstance.jpeg.mockReturnValue(mockSharpInstance);

        // Mock sharp constructor
        (sharp as any).mockReturnValue(mockSharpInstance);

        // Mock sharp.kernel
        (sharp as any).kernel = {
            lanczos3: 'lanczos3',
            cubic: 'cubic'
        };

        testImagePath = '/test/input.jpg';
        testOutputPath = '/test/output.jpg';
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('convertAspectRatio', () => {
        const targetAspectRatio: AspectRatio = {
            width: 4,
            height: 6,
            name: '4x6'
        };

        const cropArea: CropArea = {
            x: 100,
            y: 100,
            width: 800,
            height: 600,
            confidence: 0.9
        };

        beforeEach(() => {
            mockSharpInstance.metadata.mockResolvedValue({
                width: 1200,
                height: 900,
                format: 'jpeg'
            });
            mockSharpInstance.toFile.mockResolvedValue({});
        });

        it('should convert image to target aspect ratio successfully', async () => {
            const result = await service.convertAspectRatio(
                testImagePath,
                testOutputPath,
                targetAspectRatio,
                cropArea
            );

            expect(sharp).toHaveBeenCalledWith(testImagePath);
            expect(mockSharpInstance.extract).toHaveBeenCalledWith({
                left: 100,
                top: 100,
                width: 800,
                height: 600
            });
            expect(mockSharpInstance.toFile).toHaveBeenCalledWith(testOutputPath);
            expect(result.originalSize).toEqual({ width: 1200, height: 900 });
            expect(result.cropArea).toEqual(cropArea);
        });

        it('should handle upscaling when crop area is smaller than minimum output size', async () => {
            const smallCropArea: CropArea = {
                x: 0,
                y: 0,
                width: 400,
                height: 300,
                confidence: 0.8
            };

            const result = await service.convertAspectRatio(
                testImagePath,
                testOutputPath,
                targetAspectRatio,
                smallCropArea,
                { minOutputSize: { width: 800, height: 600 } }
            );

            expect(mockSharpInstance.resize).toHaveBeenCalled();
            expect(result.upscaleFactor).toBeGreaterThan(1);
        });

        it('should apply sharpening for moderate upscaling', async () => {
            const smallCropArea: CropArea = {
                x: 0,
                y: 0,
                width: 600,
                height: 450,
                confidence: 0.8
            };

            mockSharpInstance.metadata
                .mockResolvedValueOnce({ width: 1200, height: 900, format: 'jpeg' })
                .mockResolvedValueOnce({ width: 600, height: 450 });

            await service.convertAspectRatio(
                testImagePath,
                testOutputPath,
                targetAspectRatio,
                smallCropArea,
                { minOutputSize: { width: 800, height: 600 } }
            );

            expect(mockSharpInstance.sharpen).toHaveBeenCalledWith({
                sigma: 0.5,
                m1: 0.5,
                m2: 2.0
            });
        });

        it('should apply noise reduction for significant upscaling', async () => {
            const verySmallCropArea: CropArea = {
                x: 0,
                y: 0,
                width: 300,
                height: 225,
                confidence: 0.7
            };

            mockSharpInstance.metadata
                .mockResolvedValueOnce({ width: 1200, height: 900, format: 'jpeg' })
                .mockResolvedValueOnce({ width: 300, height: 225 });

            await service.convertAspectRatio(
                testImagePath,
                testOutputPath,
                targetAspectRatio,
                verySmallCropArea,
                { minOutputSize: { width: 800, height: 600 } }
            );

            expect(mockSharpInstance.median).toHaveBeenCalledWith(1);
            expect(mockSharpInstance.sharpen).toHaveBeenCalledWith({
                sigma: 0.8,
                m1: 0.8,
                m2: 2.5
            });
        });

        it('should respect maximum upscale factor', async () => {
            const tinyArea: CropArea = {
                x: 0,
                y: 0,
                width: 100,
                height: 75,
                confidence: 0.6
            };

            const result = await service.convertAspectRatio(
                testImagePath,
                testOutputPath,
                targetAspectRatio,
                tinyArea,
                { maxUpscaleFactor: 1.5 }
            );

            expect(result.upscaleFactor).toBeLessThanOrEqual(1.5);
        });

        it('should throw error for invalid image dimensions', async () => {
            mockSharpInstance.metadata.mockResolvedValue({
                width: null,
                height: null
            });

            await expect(
                service.convertAspectRatio(testImagePath, testOutputPath, targetAspectRatio, cropArea)
            ).rejects.toThrow('Unable to read image dimensions');
        });

        it('should use custom quality settings', async () => {
            await service.convertAspectRatio(
                testImagePath,
                testOutputPath,
                targetAspectRatio,
                cropArea,
                { quality: 95 }
            );

            expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({
                quality: 95,
                progressive: true
            });
        });
    });

    describe('getImageMetadata', () => {
        it('should return complete image metadata', async () => {
            mockSharpInstance.metadata.mockResolvedValue({
                width: 1920,
                height: 1080,
                format: 'jpeg',
                size: 2048000
            });
            mockSharpInstance.stats.mockResolvedValue({});

            const metadata = await service.getImageMetadata(testImagePath);

            expect(metadata).toEqual({
                width: 1920,
                height: 1080,
                format: 'jpeg',
                size: 2048000,
                aspectRatio: 1920 / 1080
            });
        });

        it('should handle missing metadata gracefully', async () => {
            mockSharpInstance.metadata.mockResolvedValue({
                width: 1920,
                height: 1080,
                format: undefined,
                size: undefined
            });
            mockSharpInstance.stats.mockResolvedValue({});

            const metadata = await service.getImageMetadata(testImagePath);

            expect(metadata.format).toBe('unknown');
            expect(metadata.size).toBe(0);
        });

        it('should throw error for invalid image', async () => {
            mockSharpInstance.metadata.mockResolvedValue({
                width: null,
                height: null
            });

            await expect(service.getImageMetadata(testImagePath)).rejects.toThrow(
                'Unable to read image dimensions'
            );
        });
    });

    describe('createThumbnail', () => {
        beforeEach(() => {
            mockSharpInstance.metadata.mockResolvedValue({
                width: 1920,
                height: 1080
            });
            mockSharpInstance.toFile.mockResolvedValue({});
        });

        it('should create thumbnail for landscape image', async () => {
            const dimensions = await service.createThumbnail(
                testImagePath,
                testOutputPath,
                300
            );

            expect(mockSharpInstance.resize).toHaveBeenCalledWith(300, 169, {
                kernel: 'lanczos3',
                fit: 'inside'
            });
            expect(dimensions).toEqual({ width: 300, height: 169 });
        });

        it('should create thumbnail for portrait image', async () => {
            mockSharpInstance.metadata.mockResolvedValue({
                width: 1080,
                height: 1920
            });

            const dimensions = await service.createThumbnail(
                testImagePath,
                testOutputPath,
                300
            );

            expect(mockSharpInstance.resize).toHaveBeenCalledWith(169, 300, {
                kernel: 'lanczos3',
                fit: 'inside'
            });
            expect(dimensions).toEqual({ width: 169, height: 300 });
        });

        it('should use default max size when not specified', async () => {
            await service.createThumbnail(testImagePath, testOutputPath);

            expect(mockSharpInstance.resize).toHaveBeenCalledWith(300, 169, {
                kernel: 'lanczos3',
                fit: 'inside'
            });
        });
    });

    describe('validateImage', () => {
        it('should validate correct image successfully', async () => {
            const mockMetadata = {
                width: 1920,
                height: 1080,
                format: 'jpeg'
            };
            mockSharpInstance.metadata.mockResolvedValue(mockMetadata);

            const result = await service.validateImage(testImagePath);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.metadata).toEqual(mockMetadata);
        });

        it('should reject image with invalid dimensions', async () => {
            mockSharpInstance.metadata.mockResolvedValue({
                width: null,
                height: null,
                format: 'jpeg'
            });

            const result = await service.validateImage(testImagePath);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Image has invalid dimensions');
        });

        it('should reject image that is too small', async () => {
            mockSharpInstance.metadata.mockResolvedValue({
                width: 50,
                height: 50,
                format: 'jpeg'
            });

            const result = await service.validateImage(testImagePath);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Image width is too small (minimum 100px)');
            expect(result.errors).toContain('Image height is too small (minimum 100px)');
        });

        it('should reject unsupported image format', async () => {
            mockSharpInstance.metadata.mockResolvedValue({
                width: 1920,
                height: 1080,
                format: 'bmp'
            });

            const result = await service.validateImage(testImagePath);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Unsupported image format: bmp');
        });

        it('should handle image reading errors', async () => {
            mockSharpInstance.metadata.mockRejectedValue(new Error('File not found'));

            const result = await service.validateImage(testImagePath);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Failed to read image: File not found');
        });

        it('should accept all supported formats', async () => {
            const supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'tiff'];

            for (const format of supportedFormats) {
                mockSharpInstance.metadata.mockResolvedValue({
                    width: 1920,
                    height: 1080,
                    format
                });

                const result = await service.validateImage(testImagePath);
                expect(result.isValid).toBe(true);
            }
        });
    });

    describe('quality score calculation', () => {
        it('should calculate quality score correctly', async () => {
            const cropArea: CropArea = {
                x: 0,
                y: 0,
                width: 800,
                height: 600,
                confidence: 0.9
            };

            mockSharpInstance.metadata.mockResolvedValue({
                width: 1200,
                height: 900,
                format: 'jpeg'
            });

            const result = await service.convertAspectRatio(
                testImagePath,
                testOutputPath,
                { width: 4, height: 6, name: '4x6' },
                cropArea
            );

            // Quality score should be high for good crop area and confidence
            expect(result.qualityScore).toBeGreaterThan(80);
        });

        it('should penalize significant upscaling', async () => {
            const smallCropArea: CropArea = {
                x: 0,
                y: 0,
                width: 200,
                height: 150,
                confidence: 0.9
            };

            mockSharpInstance.metadata
                .mockResolvedValueOnce({ width: 1200, height: 900, format: 'jpeg' })
                .mockResolvedValueOnce({ width: 200, height: 150 });

            const result = await service.convertAspectRatio(
                testImagePath,
                testOutputPath,
                { width: 4, height: 6, name: '4x6' },
                smallCropArea,
                { minOutputSize: { width: 800, height: 600 } }
            );

            // Quality score should be lower due to upscaling
            expect(result.qualityScore).toBeLessThan(80);
        });
    });
});