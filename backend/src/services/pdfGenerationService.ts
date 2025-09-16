import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ComposedSheet, ProcessingOptions } from '../types/index.js';

export class PDFGenerationService {
  // A4 dimensions in points (72 DPI standard for PDF)
  private static readonly A4_PORTRAIT = { width: 595.28, height: 841.89 };
  private static readonly A4_LANDSCAPE = { width: 841.89, height: 595.28 };

  /**
   * Generates a multi-page PDF from composed A4 sheets
   */
  async generatePDF(
    sheets: ComposedSheet[],
    outputDir: string,
    processingOptions?: ProcessingOptions
  ): Promise<string> {
    if (sheets.length === 0) {
      throw new Error('No sheets provided for PDF generation');
    }

    const pdfId = uuidv4();
    const pdfFilename = `composed_sheets_${pdfId}.pdf`;
    const pdfPath = path.join(outputDir, pdfFilename);

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      layout: sheets[0].orientation === 'portrait' ? 'portrait' : 'landscape',
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });

    // Create write stream
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Add metadata
    this.addMetadata(doc, sheets, processingOptions);

    // Add each sheet as a page
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      
      // Add new page for subsequent sheets
      if (i > 0) {
        doc.addPage({
          size: 'A4',
          layout: sheet.orientation === 'portrait' ? 'portrait' : 'landscape',
          margins: { top: 0, bottom: 0, left: 0, right: 0 }
        });
      }

      await this.addSheetToPage(doc, sheet);
    }

    // Finalize the PDF
    doc.end();

    // Wait for the stream to finish
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return pdfPath;
  }

  /**
   * Adds metadata to the PDF document
   */
  private addMetadata(
    doc: PDFDocument, 
    sheets: ComposedSheet[], 
    processingOptions?: ProcessingOptions
  ): void {
    const now = new Date();
    
    doc.info = {
      Title: 'Composed Image Sheets',
      Author: 'Image Aspect Ratio Converter',
      Subject: 'Processed images arranged in A4 sheets',
      Creator: 'Image Aspect Ratio Converter Service',
      Producer: 'PDFKit',
      CreationDate: now,
      ModDate: now
    };

    // Add processing options as custom metadata if available
    if (processingOptions) {
      const metadata = {
        AspectRatio: processingOptions.aspectRatio.name,
        FaceDetectionEnabled: processingOptions.faceDetectionEnabled.toString(),
        TotalSheets: sheets.length.toString(),
        TotalImages: sheets.reduce((sum, sheet) => sum + sheet.images.length, 0).toString()
      };

      if (processingOptions.sheetComposition) {
        metadata['GridLayout'] = processingOptions.sheetComposition.gridLayout.name;
        metadata['SheetOrientation'] = processingOptions.sheetComposition.orientation;
      }

      // Add custom metadata (note: PDFKit doesn't directly support custom metadata,
      // but we can add it to the info object)
      Object.assign(doc.info, metadata);
    }
  }

  /**
   * Adds a composed sheet image to the current PDF page
   */
  private async addSheetToPage(doc: PDFDocument, sheet: ComposedSheet): Promise<void> {
    try {
      // Check if sheet file exists
      if (!fs.existsSync(sheet.sheetPath)) {
        throw new Error(`Sheet file not found: ${sheet.sheetPath}`);
      }

      // Get PDF page dimensions
      const pageDimensions = sheet.orientation === 'portrait' 
        ? PDFGenerationService.A4_PORTRAIT 
        : PDFGenerationService.A4_LANDSCAPE;

      // Add the sheet image to fill the entire page
      doc.image(sheet.sheetPath, 0, 0, {
        width: pageDimensions.width,
        height: pageDimensions.height,
        fit: [pageDimensions.width, pageDimensions.height],
        align: 'center',
        valign: 'center'
      });

    } catch (error) {
      console.error(`Error adding sheet ${sheet.id} to PDF:`, error);
      
      // Add error page instead of failing completely
      this.addErrorPage(doc, sheet, error as Error);
    }
  }

  /**
   * Adds an error page when a sheet cannot be processed
   */
  private addErrorPage(doc: PDFDocument, sheet: ComposedSheet, error: Error): void {
    const pageDimensions = sheet.orientation === 'portrait' 
      ? PDFGenerationService.A4_PORTRAIT 
      : PDFGenerationService.A4_LANDSCAPE;

    // Add white background
    doc.rect(0, 0, pageDimensions.width, pageDimensions.height)
       .fill('white');

    // Add error message
    doc.fontSize(16)
       .fillColor('red')
       .text('Error Processing Sheet', 50, 100);
    
    doc.fontSize(12)
       .fillColor('black')
       .text(`Sheet ID: ${sheet.id}`, 50, 130)
       .text(`Layout: ${sheet.layout.name}`, 50, 150)
       .text(`Images: ${sheet.images.length}`, 50, 170)
       .text(`Error: ${error.message}`, 50, 190);
  }

  /**
   * Generates a PDF with high-resolution settings for print quality
   */
  async generateHighResolutionPDF(
    sheets: ComposedSheet[],
    outputDir: string,
    processingOptions?: ProcessingOptions
  ): Promise<string> {
    if (sheets.length === 0) {
      throw new Error('No sheets provided for high-resolution PDF generation');
    }

    const pdfId = uuidv4();
    const pdfFilename = `high_res_sheets_${pdfId}.pdf`;
    const pdfPath = path.join(outputDir, pdfFilename);

    // Create PDF document with high-resolution settings
    const doc = new PDFDocument({
      size: 'A4',
      layout: sheets[0].orientation === 'portrait' ? 'portrait' : 'landscape',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      pdfVersion: '1.4',
      compress: false // Disable compression for maximum quality
    });

    // Create write stream
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Add metadata
    this.addMetadata(doc, sheets, processingOptions);

    // Add each sheet as a page with high-resolution settings
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      
      // Add new page for subsequent sheets
      if (i > 0) {
        doc.addPage({
          size: 'A4',
          layout: sheet.orientation === 'portrait' ? 'portrait' : 'landscape',
          margins: { top: 0, bottom: 0, left: 0, right: 0 }
        });
      }

      await this.addHighResolutionSheetToPage(doc, sheet);
    }

    // Finalize the PDF
    doc.end();

    // Wait for the stream to finish
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return pdfPath;
  }

  /**
   * Adds a sheet to the PDF page with high-resolution settings
   */
  private async addHighResolutionSheetToPage(doc: PDFDocument, sheet: ComposedSheet): Promise<void> {
    try {
      // Check if sheet file exists
      if (!fs.existsSync(sheet.sheetPath)) {
        throw new Error(`Sheet file not found: ${sheet.sheetPath}`);
      }

      // Get PDF page dimensions
      const pageDimensions = sheet.orientation === 'portrait' 
        ? PDFGenerationService.A4_PORTRAIT 
        : PDFGenerationService.A4_LANDSCAPE;

      // Add the sheet image with high-resolution settings
      doc.image(sheet.sheetPath, 0, 0, {
        width: pageDimensions.width,
        height: pageDimensions.height,
        fit: [pageDimensions.width, pageDimensions.height],
        align: 'center',
        valign: 'center'
      });

    } catch (error) {
      console.error(`Error adding high-resolution sheet ${sheet.id} to PDF:`, error);
      
      // Add error page instead of failing completely
      this.addErrorPage(doc, sheet, error as Error);
    }
  }

  /**
   * Validates that all sheet files exist before PDF generation
   */
  validateSheetFiles(sheets: ComposedSheet[]): { isValid: boolean; missingFiles: string[] } {
    const missingFiles: string[] = [];
    
    for (const sheet of sheets) {
      if (!fs.existsSync(sheet.sheetPath)) {
        missingFiles.push(sheet.sheetPath);
      }
    }
    
    return {
      isValid: missingFiles.length === 0,
      missingFiles
    };
  }

  /**
   * Gets PDF generation statistics
   */
  getPDFStats(sheets: ComposedSheet[]): {
    totalSheets: number;
    totalImages: number;
    orientations: { portrait: number; landscape: number };
    layouts: Record<string, number>;
  } {
    const stats = {
      totalSheets: sheets.length,
      totalImages: sheets.reduce((sum, sheet) => sum + sheet.images.length, 0),
      orientations: { portrait: 0, landscape: 0 },
      layouts: {} as Record<string, number>
    };

    sheets.forEach(sheet => {
      // Count orientations
      if (sheet.orientation === 'portrait') {
        stats.orientations.portrait++;
      } else {
        stats.orientations.landscape++;
      }

      // Count layouts
      const layoutName = sheet.layout.name;
      stats.layouts[layoutName] = (stats.layouts[layoutName] || 0) + 1;
    });

    return stats;
  }
}

// Export singleton instance
export const pdfGenerationService = new PDFGenerationService();