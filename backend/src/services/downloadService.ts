import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { getDatabase } from '../database/connection';
import { aiNamingService } from './aiNamingService.js';
import { DownloadUrls } from '../types';

export interface DownloadableFile {
  path: string;
  name: string;
  type: 'image' | 'sheet' | 'pdf';
}

export class DownloadService {
  private db: any;

  constructor() {
    // Lazy load database to avoid circular dependencies in tests
  }

  private getDb() {
    if (!this.db) {
      this.db = getDatabase();
    }
    return this.db;
  }

  /**
   * Generate download URLs for a completed job
   */
  async generateDownloadUrls(jobId: string): Promise<DownloadUrls> {
    const db = this.getDb();
    const processedImages = await db.getProcessedImagesByJobId(jobId);
    const composedSheets = await db.getComposedSheetsByJobId(jobId);
    const job = await db.getJob(jobId);

    const downloadUrls: DownloadUrls = {
      individualImages: {},
      sheets: {}
    };

    // Generate URLs for individual processed images
    for (const image of processedImages) {
      downloadUrls.individualImages[image.id] = `/api/download/image/${image.id}`;
    }

    // Generate URLs for composed sheets
    for (const sheet of composedSheets) {
      downloadUrls.sheets[sheet.id] = `/api/download/sheet/${sheet.id}`;
    }

    // Add ZIP URL if there are multiple outputs
    if (processedImages.length > 1 || composedSheets.length > 0) {
      downloadUrls.zip = `/api/download/zip/${jobId}`;
    }

    // Add PDF URL if PDF generation was requested and enabled
    if (job?.options.sheetComposition?.enabled && job?.options.sheetComposition?.generatePDF) {
      const pdfPath = path.join(__dirname, '../../processed', `${jobId}.pdf`);
      if (fs.existsSync(pdfPath)) {
        downloadUrls.pdf = `/api/download/pdf/${jobId}`;
      }
    }

    return downloadUrls;
  }

  /**
   * Get downloadable files for a job
   */
  async getDownloadableFiles(jobId: string): Promise<DownloadableFile[]> {
    const db = this.getDb();
    const processedImages = await db.getProcessedImagesByJobId(jobId);
    const composedSheets = await db.getComposedSheetsByJobId(jobId);
    const files = await db.getFilesByJobId(jobId);
    
    const downloadableFiles: DownloadableFile[] = [];

    // Add processed images with AI-generated names
    for (const image of processedImages) {
      if (fs.existsSync(image.processedPath)) {
        const originalFile = files.find((f: any) => f.id === image.originalFileId);
        if (originalFile) {
          const ext = path.extname(originalFile.originalName);
          const baseName = path.basename(originalFile.originalName, ext);
          
          // Try to generate AI-powered descriptive name
          let fileName: string;
          try {
            const descriptiveName = await aiNamingService.generateImageName(
              image.processedPath,
              { fallbackName: baseName, useCache: true }
            );
            // Add unique identifier to prevent filename collisions
            const uniqueId = image.id.slice(0, 8);
            fileName = `${descriptiveName}_${uniqueId}_${image.aspectRatio.name}${ext}`;
          } catch (error) {
            console.warn('Failed to generate AI name for download, using fallback:', error);
            fileName = `${baseName}_${image.aspectRatio.name}${ext}`;
          }
          
          downloadableFiles.push({
            path: image.processedPath,
            name: fileName,
            type: 'image'
          });
        }
      }
    }

    // Add composed sheets
    for (const sheet of composedSheets) {
      if (fs.existsSync(sheet.sheetPath)) {
        const ext = path.extname(sheet.sheetPath);
        const fileName = `sheet_${sheet.layout.name}_${sheet.orientation}${ext}`;
        
        downloadableFiles.push({
          path: sheet.sheetPath,
          name: fileName,
          type: 'sheet'
        });
      }
    }

    // Add PDF if it exists
    const pdfPath = path.join(__dirname, '../../processed', `${jobId}.pdf`);
    if (fs.existsSync(pdfPath)) {
      downloadableFiles.push({
        path: pdfPath,
        name: `processed_sheets_${jobId}.pdf`,
        type: 'pdf'
      });
    }

    return downloadableFiles;
  }

  /**
   * Create ZIP archive for a job
   */
  async createZipArchive(jobId: string, outputPath?: string): Promise<string> {
    const downloadableFiles = await this.getDownloadableFiles(jobId);
    
    if (downloadableFiles.length === 0) {
      throw new Error('No files available for ZIP creation');
    }

    const zipPath = outputPath || path.join(__dirname, '../../processed', `${jobId}.zip`);
    
    // Ensure output directory exists
    const outputDir = path.dirname(zipPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      output.on('close', () => {
        console.log(`ZIP archive created: ${zipPath} (${archive.pointer()} total bytes)`);
        resolve(zipPath);
      });

      archive.on('error', (err) => {
        console.error('Archive error:', err);
        reject(err);
      });

      archive.pipe(output);

      // Add files to archive with organized folder structure
      for (const file of downloadableFiles) {
        let folderName = '';
        
        switch (file.type) {
          case 'image':
            folderName = 'processed_images/';
            break;
          case 'sheet':
            folderName = 'composed_sheets/';
            break;
          case 'pdf':
            folderName = '';
            break;
        }

        archive.file(file.path, { name: folderName + file.name });
      }

      archive.finalize();
    });
  }

  /**
   * Generate appropriate filename for download
   */
  generateDownloadFilename(originalName: string, suffix: string, extension?: string): string {
    const ext = extension || path.extname(originalName);
    const baseName = path.basename(originalName, path.extname(originalName));
    return `${baseName}_${suffix}${ext}`;
  }

  /**
   * Validate file exists and is accessible
   */
  validateFileAccess(filePath: string): boolean {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch (error) {
      console.error('File access validation error:', error);
      return false;
    }
  }

  /**
   * Get file size in bytes
   */
  getFileSize(filePath: string): number {
    try {
      return fs.statSync(filePath).size;
    } catch (error) {
      console.error('Error getting file size:', error);
      return 0;
    }
  }

  /**
   * Clean up temporary ZIP files
   */
  async cleanupZipFiles(olderThanHours: number = 1): Promise<void> {
    const processedDir = path.join(__dirname, '../../processed');
    
    if (!fs.existsSync(processedDir)) {
      return;
    }

    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    try {
      const files = fs.readdirSync(processedDir);
      
      for (const file of files) {
        if (file.endsWith('.zip')) {
          const filePath = path.join(processedDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime < cutoffTime) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up old ZIP file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up ZIP files:', error);
    }
  }
}

// Export singleton instance
export const downloadService = new DownloadService();