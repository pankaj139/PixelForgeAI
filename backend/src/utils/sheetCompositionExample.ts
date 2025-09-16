/**
 * Example usage of the SheetCompositionService
 * This demonstrates how to integrate sheet composition into the processing pipeline
 */

import { sheetCompositionService, SheetCompositionService } from '../services/sheetCompositionService.js';
import { ProcessedImage, GridLayout, ComposedSheet } from '../types/index.js';
import path from 'path';

/**
 * Example function showing how to use sheet composition in a processing pipeline
 */
export async function processImagesWithSheetComposition(
  processedImages: ProcessedImage[],
  gridLayoutName: string = '2x2',
  orientation: 'portrait' | 'landscape' = 'portrait',
  outputDir: string
): Promise<{
  individualImages: ProcessedImage[];
  composedSheets: ComposedSheet[];
}> {
  try {
    // Get the grid layout
    const gridLayout = SheetCompositionService.getGridLayoutByName(gridLayoutName);
    if (!gridLayout) {
      throw new Error(`Invalid grid layout: ${gridLayoutName}`);
    }

    console.log(`Creating A4 sheets with ${gridLayout.name} layout in ${orientation} orientation`);
    console.log(`Processing ${processedImages.length} images`);

    // Create composed sheets
    const composedSheets = await sheetCompositionService.composeA4Sheets(
      processedImages,
      gridLayout,
      orientation,
      outputDir
    );

    console.log(`Created ${composedSheets.length} A4 sheets`);
    
    // Log sheet details
    composedSheets.forEach((sheet, index) => {
      console.log(`Sheet ${index + 1}:`);
      console.log(`  - Images: ${sheet.images.length}`);
      console.log(`  - Empty slots: ${sheet.emptySlots}`);
      console.log(`  - File: ${path.basename(sheet.sheetPath)}`);
    });

    return {
      individualImages: processedImages,
      composedSheets
    };

  } catch (error) {
    console.error('Error in sheet composition example:', error);
    throw error;
  }
}

/**
 * Example function to get available grid layouts
 */
export function getAvailableGridLayouts(): GridLayout[] {
  return SheetCompositionService.getGridLayouts();
}

/**
 * Example function to calculate how many sheets will be needed
 */
export function calculateRequiredSheets(imageCount: number, gridLayoutName: string): number {
  const gridLayout = SheetCompositionService.getGridLayoutByName(gridLayoutName);
  if (!gridLayout) {
    throw new Error(`Invalid grid layout: ${gridLayoutName}`);
  }

  const imagesPerSheet = gridLayout.rows * gridLayout.columns;
  return Math.ceil(imageCount / imagesPerSheet);
}

/**
 * Example function to validate sheet composition options
 */
export function validateSheetCompositionOptions(
  imageCount: number,
  gridLayoutName: string,
  orientation: 'portrait' | 'landscape'
): { isValid: boolean; message?: string } {
  if (imageCount <= 0) {
    return { isValid: false, message: 'At least one image is required' };
  }

  const gridLayout = SheetCompositionService.getGridLayoutByName(gridLayoutName);
  if (!gridLayout) {
    return { isValid: false, message: `Invalid grid layout: ${gridLayoutName}` };
  }

  if (!['portrait', 'landscape'].includes(orientation)) {
    return { isValid: false, message: 'Orientation must be portrait or landscape' };
  }

  const requiredSheets = calculateRequiredSheets(imageCount, gridLayoutName);
  if (requiredSheets > 50) {
    return { 
      isValid: false, 
      message: `Too many sheets required (${requiredSheets}). Consider using a larger grid layout.` 
    };
  }

  return { isValid: true };
}