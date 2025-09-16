import Sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { 
  ProcessedImage, 
  ComposedSheet, 
  GridLayout, 
  Dimensions 
} from '../types/index.js';
import { getPythonServiceClient } from './pythonServiceClient.js';

export class SheetCompositionService {
  private pythonClient = getPythonServiceClient();
  
  // A4 dimensions in pixels at 300 DPI (print quality)  
  // This service ensures NO image stretching - all images maintain their aspect ratios
  private static readonly A4_PORTRAIT: Dimensions = { width: 2480, height: 3508 };
  private static readonly A4_LANDSCAPE: Dimensions = { width: 3508, height: 2480 };
  
  // Margins and spacing in pixels - optimized for maximum space utilization
  private static readonly MARGIN = 30; // Minimal margin (10px at 300 DPI)
  private static readonly SPACING = 15; // Minimal spacing between images (5px at 300 DPI)
  private static readonly SMALL_SPACING = 10; // Ultra-minimal spacing for dense layouts (3px at 300 DPI)

  /**
   * Creates A4 sheets with processed images arranged in specified grid layout
   */
  async composeA4Sheets(
    images: ProcessedImage[],
    layout: GridLayout,
    orientation: 'portrait' | 'landscape',
    outputDir: string
  ): Promise<ComposedSheet[]> {
    if (images.length === 0) {
      throw new Error('No images provided for sheet composition');
    }

    try {
      // Try Python service sheet composition first
      console.log('Attempting Python service sheet composition');
      
      const imagePaths = images.map(img => img.processedPath);
      
      const compositionRequest = {
        processed_images: imagePaths,
        grid_layout: {
          rows: layout.rows,
          columns: layout.columns
        },
        sheet_orientation: orientation,
        output_format: 'image' as const
      };

      const result = await this.pythonClient.composeSheet(compositionRequest);
      
      // Generate sheet ID and move to output directory
      const sheetId = uuidv4();
      const sheetFilename = `composed_sheets_${sheetId}.${result.format === 'pdf' ? 'pdf' : 'jpg'}`;
      const finalSheetPath = path.join(outputDir, sheetFilename);
      
      // Copy the composed sheet to the desired output path
      await Sharp(result.output_path).toFile(finalSheetPath);
      
      console.log('Python service sheet composition completed successfully');

      return [{
        id: sheetId,
        sheetPath: finalSheetPath,
        layout,
        orientation,
        images,
        emptySlots: Math.max(0, (layout.rows * layout.columns) - images.length),
        createdAt: new Date()
      }];

    } catch (error) {
      console.warn('Python service sheet composition failed, falling back to local processing:', error);
      
      // Fallback to local sheet composition
      return this.composeA4SheetsLocally(images, layout, orientation, outputDir);
    }
  }

  /**
   * Local fallback sheet composition when Python service is unavailable
   */
  private async composeA4SheetsLocally(
    images: ProcessedImage[],
    layout: GridLayout,
    orientation: 'portrait' | 'landscape',
    outputDir: string
  ): Promise<ComposedSheet[]> {
    const sheets: ComposedSheet[] = [];
    const imagesPerSheet = layout.rows * layout.columns;
    const totalSheets = Math.ceil(images.length / imagesPerSheet);

    for (let sheetIndex = 0; sheetIndex < totalSheets; sheetIndex++) {
      const startIndex = sheetIndex * imagesPerSheet;
      const endIndex = Math.min(startIndex + imagesPerSheet, images.length);
      const sheetImages = images.slice(startIndex, endIndex);
      
      const sheet = await this.createSingleSheet(
        sheetImages,
        layout,
        orientation,
        outputDir,
        sheetIndex
      );
      
      sheets.push(sheet);
    }

    return sheets;
  }

  /**
   * Creates a single A4 sheet with the provided images
   */
  private async createSingleSheet(
    images: ProcessedImage[],
    layout: GridLayout,
    orientation: 'portrait' | 'landscape',
    outputDir: string,
    sheetIndex: number
  ): Promise<ComposedSheet> {
    const sheetId = uuidv4();
    const sheetFilename = `sheet_${sheetIndex + 1}_${sheetId}.jpg`;
    const sheetPath = path.join(outputDir, sheetFilename);

    // Get A4 dimensions based on orientation
    const canvasDimensions = orientation === 'portrait' 
      ? SheetCompositionService.A4_PORTRAIT 
      : SheetCompositionService.A4_LANDSCAPE;

    // Calculate cell dimensions and positions
    const cellDimensions = this.calculateCellDimensions(layout, canvasDimensions);
    const cellPositions = this.calculateCellPositions(layout, cellDimensions, canvasDimensions);

    // Create the A4 canvas
    const canvas = Sharp({
      create: {
        width: canvasDimensions.width,
        height: canvasDimensions.height,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    });

    // Prepare composite operations for each image
    const compositeOperations = [];
    
    for (let i = 0; i < images.length && i < cellPositions.length; i++) {
      const image = images[i];
      const position = cellPositions[i];
      
      try {
        // Resize image to fit cell while maintaining aspect ratio
        const resizedImageBuffer = await this.resizeImageForCell(
          image.processedPath,
          cellDimensions
        );
        
        compositeOperations.push({
          input: resizedImageBuffer,
          left: position.x,
          top: position.y
        });
      } catch (error) {
        console.error(`Error processing image ${image.id} for sheet:`, error);
        // Continue with other images even if one fails
      }
    }

    // Composite all images onto the canvas
    if (compositeOperations.length > 0) {
      canvas.composite(compositeOperations);
    }

    // Save the composed sheet
    await canvas.jpeg({ quality: 95 }).toFile(sheetPath);

    const emptySlots = (layout.rows * layout.columns) - images.length;

    return {
      id: sheetId,
      sheetPath,
      layout,
      orientation,
      images,
      emptySlots: Math.max(0, emptySlots),
      createdAt: new Date()
    };
  }

  /**
   * Calculates the dimensions for each cell in the grid
   */
  private calculateCellDimensions(layout: GridLayout, canvasDimensions: Dimensions): Dimensions {
    const { rows, columns } = layout;
    const { width: canvasWidth, height: canvasHeight } = canvasDimensions;
    
    // Calculate available space after margins
    const availableWidth = canvasWidth - (2 * SheetCompositionService.MARGIN);
    const availableHeight = canvasHeight - (2 * SheetCompositionService.MARGIN);
    
    // Calculate spacing between cells
    const horizontalSpacing = (columns - 1) * this.getSpacingForLayout(layout);
    const verticalSpacing = (rows - 1) * this.getSpacingForLayout(layout);
    
    // Calculate cell dimensions
    const cellWidth = Math.floor((availableWidth - horizontalSpacing) / columns);
    const cellHeight = Math.floor((availableHeight - verticalSpacing) / rows);
    
    return { width: cellWidth, height: cellHeight };
  }

  /**
   * Calculates the position of each cell in the grid - centered for optimal space usage
   */
  private calculateCellPositions(
    layout: GridLayout, 
    cellDimensions: Dimensions, 
    canvasDimensions: Dimensions
  ): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];
    const spacing = this.getSpacingForLayout(layout);
    
    // Calculate total grid dimensions
    const totalGridWidth = layout.columns * cellDimensions.width + (layout.columns - 1) * spacing;
    const totalGridHeight = layout.rows * cellDimensions.height + (layout.rows - 1) * spacing;
    
    // Center the grid on the canvas for optimal space usage
    const startX = Math.max(SheetCompositionService.MARGIN, (canvasDimensions.width - totalGridWidth) / 2);
    const startY = Math.max(SheetCompositionService.MARGIN, (canvasDimensions.height - totalGridHeight) / 2);
    
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.columns; col++) {
        const x = Math.round(startX + col * (cellDimensions.width + spacing));
        const y = Math.round(startY + row * (cellDimensions.height + spacing));
        
        positions.push({ x, y });
      }
    }
    
    return positions;
  }

  /**
   * Gets appropriate spacing based on layout type - optimized for maximum space
   */
  private getSpacingForLayout(layout: GridLayout): number {
    const totalCells = layout.rows * layout.columns;
    
    // Use progressively smaller spacing for denser layouts
    if (totalCells >= 6) {
      return SheetCompositionService.SMALL_SPACING; // Ultra-minimal for 6+ images
    } else if (totalCells >= 4) {
      return SheetCompositionService.SMALL_SPACING; // Minimal for 4-5 images
    } else if (layout.name === '1x3') {
      return SheetCompositionService.SMALL_SPACING; // Minimal for 1x3 layout
    }
    return SheetCompositionService.SPACING; // Standard minimal spacing
  }

  /**
   * Resizes an image to fill the entire cell space for maximum utilization
   */
  private async resizeImageForCell(imagePath: string, cellDimensions: Dimensions): Promise<Buffer> {
    const image = Sharp(imagePath);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error(`Unable to get image dimensions for ${imagePath}`);
    }

    // Use 'inside' fit to prevent stretching - maintain aspect ratio and quality
    // If image is smaller than cell, it will be centered with padding rather than stretched
    return image
      .resize(cellDimensions.width, cellDimensions.height, {
        fit: 'inside', // Fit within bounds without stretching - PREVENTS DISTORTION
        position: 'center', // Center the image
        withoutEnlargement: true, // NEVER stretch small images
        background: { r: 255, g: 255, b: 255, alpha: 1 } // White background for padding
      })
      .jpeg({ quality: 95 })
      .toBuffer();
  }

  /**
   * Gets predefined grid layouts - optimized for maximum space utilization
   */
  static getGridLayouts(): GridLayout[] {
    return [
      { rows: 1, columns: 1, name: '1x1' }, // Single large image
      { rows: 1, columns: 2, name: '1x2' }, // Two images side by side
      { rows: 1, columns: 3, name: '1x3' }, // Three images in a row
      { rows: 1, columns: 4, name: '1x4' }, // Four images in a row
      { rows: 2, columns: 2, name: '2x2' }, // Four images in a square
      { rows: 2, columns: 3, name: '2x3' }, // Six images in 2 rows
      { rows: 3, columns: 2, name: '3x2' }, // Six images in 3 rows
      { rows: 3, columns: 3, name: '3x3' }  // Nine images in a square
    ];
  }

  /**
   * Gets a grid layout by name
   */
  static getGridLayoutByName(name: string): GridLayout | undefined {
    return this.getGridLayouts().find(layout => layout.name === name);
  }
}

// Export singleton instance
export const sheetCompositionService = new SheetCompositionService();