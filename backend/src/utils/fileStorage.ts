import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFilename } from './validation';

export interface StorageConfig {
  uploadDir: string;
  processedDir: string;
  tempDir: string;
  maxAge: number; // in milliseconds
}

export interface StoredFile {
  id: string;
  originalName: string;
  storedPath: string;
  size: number;
  mimeType: string;
  createdAt: Date;
}

export class FileStorageService {
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.ensureDirectoriesExist();
  }

  /**
   * Ensure all required directories exist
   */
  private ensureDirectoriesExist(): void {
    const dirs = [this.config.uploadDir, this.config.processedDir, this.config.tempDir];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Generate a unique filename while preserving the original extension
   */
  private generateUniqueFilename(originalName: string): string {
    const sanitized = sanitizeFilename(originalName);
    const ext = path.extname(sanitized);
    const nameWithoutExt = path.basename(sanitized, ext);
    const uniqueId = uuidv4();
    const timestamp = Date.now();
    
    return `${nameWithoutExt}_${timestamp}_${uniqueId}${ext}`;
  }

  /**
   * Store an uploaded file in the upload directory
   */
  async storeUploadedFile(file: Express.Multer.File): Promise<StoredFile> {
    const uniqueFilename = this.generateUniqueFilename(file.originalname);
    const storedPath = path.join(this.config.uploadDir, uniqueFilename);

    try {
      // Move file from temp location to upload directory
      if (file.path !== storedPath) {
        await fs.promises.copyFile(file.path, storedPath);
        // Clean up original temp file
        await this.deleteFile(file.path);
      }

      const stats = await fs.promises.stat(storedPath);

      return {
        id: uuidv4(),
        originalName: file.originalname,
        storedPath,
        size: stats.size,
        mimeType: file.mimetype,
        createdAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to store file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store a processed image in the processed directory
   */
  async storeProcessedFile(originalPath: string, originalName: string, suffix: string = '_processed'): Promise<string> {
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    const processedFilename = `${nameWithoutExt}${suffix}${ext}`;
    const uniqueFilename = this.generateUniqueFilename(processedFilename);
    const processedPath = path.join(this.config.processedDir, uniqueFilename);

    try {
      await fs.promises.copyFile(originalPath, processedPath);
      return processedPath;
    } catch (error) {
      throw new Error(`Failed to store processed file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a temporary file path
   */
  createTempFilePath(originalName: string): string {
    const uniqueFilename = this.generateUniqueFilename(originalName);
    return path.join(this.config.tempDir, uniqueFilename);
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (error) {
      console.warn(`Failed to delete file ${filePath}:`, error);
    }
  }

  /**
   * Delete multiple files
   */
  async deleteFiles(filePaths: string[]): Promise<void> {
    await Promise.all(filePaths.map(path => this.deleteFile(path)));
  }

  /**
   * Clean up old files based on maxAge
   */
  async cleanupOldFiles(): Promise<{ deleted: number; errors: string[] }> {
    const errors: string[] = [];
    let deleted = 0;
    const cutoffTime = Date.now() - this.config.maxAge;

    const directories = [this.config.uploadDir, this.config.processedDir, this.config.tempDir];

    for (const dir of directories) {
      try {
        const files = await fs.promises.readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          
          try {
            const stats = await fs.promises.stat(filePath);
            
            if (stats.isFile() && stats.mtime.getTime() < cutoffTime) {
              await this.deleteFile(filePath);
              deleted++;
            }
          } catch (error) {
            errors.push(`Failed to process file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } catch (error) {
        errors.push(`Failed to read directory ${dir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { deleted, errors };
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath: string): Promise<{ exists: boolean; size?: number; mtime?: Date }> {
    try {
      if (!fs.existsSync(filePath)) {
        return { exists: false };
      }

      const stats = await fs.promises.stat(filePath);
      return {
        exists: true,
        size: stats.size,
        mtime: stats.mtime,
      };
    } catch (error) {
      return { exists: false };
    }
  }

  /**
   * Calculate total storage usage
   */
  async getStorageUsage(): Promise<{ uploadDir: number; processedDir: number; tempDir: number; total: number }> {
    const calculateDirSize = async (dir: string): Promise<number> => {
      let totalSize = 0;
      
      try {
        const files = await fs.promises.readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.promises.stat(filePath);
          
          if (stats.isFile()) {
            totalSize += stats.size;
          }
        }
      } catch (error) {
        console.warn(`Failed to calculate size for directory ${dir}:`, error);
      }
      
      return totalSize;
    };

    const [uploadSize, processedSize, tempSize] = await Promise.all([
      calculateDirSize(this.config.uploadDir),
      calculateDirSize(this.config.processedDir),
      calculateDirSize(this.config.tempDir),
    ]);

    return {
      uploadDir: uploadSize,
      processedDir: processedSize,
      tempDir: tempSize,
      total: uploadSize + processedSize + tempSize,
    };
  }

  /**
   * Validate storage directory permissions
   */
  async validateStoragePermissions(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const directories = [this.config.uploadDir, this.config.processedDir, this.config.tempDir];

    for (const dir of directories) {
      try {
        // Test write permission
        const testFile = path.join(dir, `test_${Date.now()}.tmp`);
        await fs.promises.writeFile(testFile, 'test');
        await fs.promises.unlink(testFile);
      } catch (error) {
        errors.push(`No write permission for directory ${dir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Default storage configuration
export const createDefaultStorageConfig = (baseDir: string): StorageConfig => ({
  uploadDir: path.join(baseDir, 'uploads'),
  processedDir: path.join(baseDir, 'processed'),
  tempDir: path.join(baseDir, 'temp'),
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
});