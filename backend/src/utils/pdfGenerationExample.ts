import path from 'path';
import { fileURLToPath } from 'url';
import { sheetCompositionService } from '../services/sheetCompositionService.js';
import { pdfGenerationService } from '../services/pdfGenerationService.js';
import { ProcessedImage, GridLayout, ProcessingOptions, AspectRatio } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Example function demonstrating PDF generation from processed images
 */
export async function generatePDFFromImages(
  processedImages: ProcessedImage[],
  gridLayoutName: string = '2x2',
  orientation: 'portrait' | 'landscape' = 'portrait',
  outputDir?: string
): Promise<{ pdfPath: string; sheetsCreated: number; totalImages: number }> {
  try {
    console.log(`Generating PDF from ${processedImages.length} processed images`);
    console.log(`Using ${gridLayoutName} layout in ${orientation} orientation`);

    // Set default output directory
    const finalOutputDir = outputDir || path.join(__dirname, '../temp/pdf-output');

    // Get grid layout
    const gridLayout = sheetCompositionService.constructor.getGridLayoutByName(gridLayoutName);
    if (!gridLayout) {
      throw new Error(`Invalid grid layout: ${gridLayoutName}`);
    }

    // Create A4 sheets from processed images
    console.log('Creating A4 sheets...');
    const composedSheets = await sheetCompositionService.composeA4Sheets(
      processedImages,
      gridLayout,
      orientation,
      finalOutputDir
    );

    console.log(`Created ${composedSheets.length} A4 sheets`);
    composedSheets.forEach((sheet, index) => {
      console.log(`Sheet ${index + 1}:`);
      console.log(`  - Images: ${sheet.images.length}`);
      console.log(`  - Empty slots: ${sheet.emptySlots}`);
      console.log(`  - File: ${path.basename(sheet.sheetPath)}`);
    });

    // Generate PDF from composed sheets
    console.log('Generating PDF...');
    const processingOptions: ProcessingOptions = {
      aspectRatio: processedImages[0]?.aspectRatio || { width: 4, height: 6, name: '4x6' },
      faceDetectionEnabled: true,
      sheetComposition: {
        enabled: true,
        gridLayout,
        orientation,
        generatePDF: true
      }
    };

    const pdfPath = await pdfGenerationService.generatePDF(
      composedSheets,
      finalOutputDir,
      processingOptions
    );

    console.log(`PDF generated successfully: ${path.basename(pdfPath)}`);

    // Get PDF statistics
    const stats = pdfGenerationService.getPDFStats(composedSheets);
    console.log('PDF Statistics:');
    console.log(`  - Total sheets: ${stats.totalSheets}`);
    console.log(`  - Total images: ${stats.totalImages}`);
    console.log(`  - Orientations: ${stats.orientations.portrait} portrait, ${stats.orientations.landscape} landscape`);
    console.log(`  - Layouts: ${Object.entries(stats.layouts).map(([layout, count]) => `${count} ${layout}`).join(', ')}`);

    return {
      pdfPath,
      sheetsCreated: composedSheets.length,
      totalImages: processedImages.length
    };

  } catch (error) {
    console.error('Error in PDF generation example:', error);
    throw error;
  }
}

/**
 * Example function demonstrating high-resolution PDF generation
 */
export async function generateHighResolutionPDFFromImages(
  processedImages: ProcessedImage[],
  gridLayoutName: string = '2x2',
  orientation: 'portrait' | 'landscape' = 'portrait',
  outputDir?: string
): Promise<{ pdfPath: string; sheetsCreated: number; totalImages: number }> {
  try {
    console.log(`Generating high-resolution PDF from ${processedImages.length} processed images`);

    // Set default output directory
    const finalOutputDir = outputDir || path.join(__dirname, '../temp/pdf-output');

    // Get grid layout
    const gridLayout = sheetCompositionService.constructor.getGridLayoutByName(gridLayoutName);
    if (!gridLayout) {
      throw new Error(`Invalid grid layout: ${gridLayoutName}`);
    }

    // Create A4 sheets from processed images
    const composedSheets = await sheetCompositionService.composeA4Sheets(
      processedImages,
      gridLayout,
      orientation,
      finalOutputDir
    );

    // Validate sheet files before PDF generation
    const validation = pdfGenerationService.validateSheetFiles(composedSheets);
    if (!validation.isValid) {
      throw new Error(`Missing sheet files: ${validation.missingFiles.join(', ')}`);
    }

    // Generate high-resolution PDF
    console.log('Generating high-resolution PDF...');
    const processingOptions: ProcessingOptions = {
      aspectRatio: processedImages[0]?.aspectRatio || { width: 4, height: 6, name: '4x6' },
      faceDetectionEnabled: true,
      sheetComposition: {
        enabled: true,
        gridLayout,
        orientation,
        generatePDF: true
      }
    };

    const pdfPath = await pdfGenerationService.generateHighResolutionPDF(
      composedSheets,
      finalOutputDir,
      processingOptions
    );

    console.log(`High-resolution PDF generated successfully: ${path.basename(pdfPath)}`);

    return {
      pdfPath,
      sheetsCreated: composedSheets.length,
      totalImages: processedImages.length
    };

  } catch (error) {
    console.error('Error in high-resolution PDF generation example:', error);
    throw error;
  }
}

/**
 * Example function demonstrating PDF generation with mixed orientations
 */
export async function generateMixedOrientationPDF(
  processedImages: ProcessedImage[],
  outputDir?: string
): Promise<{ pdfPath: string; sheetsCreated: number; totalImages: number }> {
  try {
    console.log(`Generating mixed orientation PDF from ${processedImages.length} processed images`);

    // Set default output directory
    const finalOutputDir = outputDir || path.join(__dirname, '../temp/pdf-output');

    // Split images into groups for different orientations
    const midpoint = Math.ceil(processedImages.length / 2);
    const portraitImages = processedImages.slice(0, midpoint);
    const landscapeImages = processedImages.slice(midpoint);

    const gridLayout = sheetCompositionService.constructor.getGridLayoutByName('2x2')!;
    
    // Create portrait sheets
    const portraitSheets = await sheetCompositionService.composeA4Sheets(
      portraitImages,
      gridLayout,
      'portrait',
      finalOutputDir
    );

    // Create landscape sheets
    const landscapeSheets = await sheetCompositionService.composeA4Sheets(
      landscapeImages,
      gridLayout,
      'landscape',
      finalOutputDir
    );

    // Combine all sheets
    const allSheets = [...portraitSheets, ...landscapeSheets];

    console.log(`Created ${allSheets.length} sheets (${portraitSheets.length} portrait, ${landscapeSheets.length} landscape)`);

    // Generate PDF with mixed orientations
    const processingOptions: ProcessingOptions = {
      aspectRatio: processedImages[0]?.aspectRatio || { width: 4, height: 6, name: '4x6' },
      faceDetectionEnabled: true,
      sheetComposition: {
        enabled: true,
        gridLayout,
        orientation: 'portrait', // Default, but sheets have individual orientations
        generatePDF: true
      }
    };

    const pdfPath = await pdfGenerationService.generatePDF(
      allSheets,
      finalOutputDir,
      processingOptions
    );

    console.log(`Mixed orientation PDF generated successfully: ${path.basename(pdfPath)}`);

    return {
      pdfPath,
      sheetsCreated: allSheets.length,
      totalImages: processedImages.length
    };

  } catch (error) {
    console.error('Error in mixed orientation PDF generation example:', error);
    throw error;
  }
}