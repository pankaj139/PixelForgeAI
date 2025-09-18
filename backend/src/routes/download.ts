import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { getDatabase } from '../database/connection';

const router = express.Router();

// Serve individual processed image for preview (no download headers)
router.get('/image/:imageId/preview', async (req: Request, res: Response) => {
  try {
    const { imageId } = req.params;
    const db = getDatabase();
    
    if (!imageId) {
      return res.status(400).json({ error: 'Image ID is required' });
    }

    const processedImage = await db.getProcessedImage(imageId);
    if (!processedImage) {
      return res.status(404).json({ error: 'Processed image not found' });
    }

    // Check if file exists
    if (!fs.existsSync(processedImage.processedPath)) {
      return res.status(404).json({ error: 'Image file not found on disk' });
    }

    // Get original file metadata for content type
    const originalFile = await db.getFile(processedImage.originalFileId);
    if (!originalFile) {
      return res.status(404).json({ error: 'Original file metadata not found' });
    }

    // Set headers for preview (no download)
    res.setHeader('Content-Type', originalFile.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    const fileStream = fs.createReadStream(processedImage.processedPath);
    fileStream.pipe(res);
    return; // Explicit return for file streaming

  } catch (error) {
    console.error('Image preview error:', error);
    return res.status(500).json({ error: 'Failed to serve image preview' });
  }
});

// Serve thumbnail for processed image (same as preview for now, could be optimized later)
router.get('/image/:imageId/thumbnail', async (req: Request, res: Response) => {
  try {
    const { imageId } = req.params;
    const db = getDatabase();
    
    if (!imageId) {
      return res.status(400).json({ error: 'Image ID is required' });
    }

    const processedImage = await db.getProcessedImage(imageId);
    if (!processedImage) {
      return res.status(404).json({ error: 'Processed image not found' });
    }

    // Check if file exists
    if (!fs.existsSync(processedImage.processedPath)) {
      return res.status(404).json({ error: 'Image file not found on disk' });
    }

    // Get original file metadata for content type
    const originalFile = await db.getFile(processedImage.originalFileId);
    if (!originalFile) {
      return res.status(404).json({ error: 'Original file metadata not found' });
    }

    // Set headers for thumbnail preview
    res.setHeader('Content-Type', originalFile.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    const fileStream = fs.createReadStream(processedImage.processedPath);
    fileStream.pipe(res);
    return; // Explicit return for file streaming

  } catch (error) {
    console.error('Image thumbnail error:', error);
    return res.status(500).json({ error: 'Failed to serve image thumbnail' });
  }
});

// Download individual processed image
router.get('/image/:imageId', async (req: Request, res: Response) => {
  try {
    const { imageId } = req.params;
    const db = getDatabase();
    
    if (!imageId) {
      return res.status(400).json({ error: 'Image ID is required' });
    }

    const processedImage = await db.getProcessedImage(imageId);
    if (!processedImage) {
      return res.status(404).json({ error: 'Processed image not found' });
    }

    // Check if file exists
    if (!fs.existsSync(processedImage.processedPath)) {
      return res.status(404).json({ error: 'Image file not found on disk' });
    }

    // Get original file metadata for filename
    const originalFile = await db.getFile(processedImage.originalFileId);
    if (!originalFile) {
      return res.status(404).json({ error: 'Original file metadata not found' });
    }

    // Use the existing AI-generated filename directly
    const downloadName = path.basename(processedImage.processedPath);

    // Set headers and send file
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('Content-Type', originalFile.mimeType);
    
    const fileStream = fs.createReadStream(processedImage.processedPath);
    fileStream.pipe(res);
    return; // Explicit return for file streaming

  } catch (error) {
    console.error('Image download error:', error);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
    }
    return res.status(500).json({ error: 'Failed to download image' });
  }
});

// Serve A4 sheet image for preview (no download headers)
router.get('/sheet/:sheetId/preview', async (req: Request, res: Response) => {
  try {
    const { sheetId } = req.params;
    const db = getDatabase();
    
    if (!sheetId) {
      return res.status(400).json({ error: 'Sheet ID is required' });
    }

    const composedSheet = await db.getComposedSheet(sheetId);
    if (!composedSheet) {
      return res.status(404).json({ error: 'Composed sheet not found' });
    }

    // Check if file exists
    if (!fs.existsSync(composedSheet.sheetPath)) {
      return res.status(404).json({ error: 'Sheet file not found on disk' });
    }

    // Set headers for preview (no download)
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    const fileStream = fs.createReadStream(composedSheet.sheetPath);
    fileStream.pipe(res);
    return; // Explicit return for file streaming

  } catch (error) {
    console.error('Sheet preview error:', error);
    return res.status(500).json({ error: 'Failed to serve sheet preview' });
  }
});

// Download A4 sheet image
router.get('/sheet/:sheetId', async (req: Request, res: Response) => {
  try {
    const { sheetId } = req.params;
    const db = getDatabase();
    
    if (!sheetId) {
      return res.status(400).json({ error: 'Sheet ID is required' });
    }

    const composedSheet = await db.getComposedSheet(sheetId);
    if (!composedSheet) {
      return res.status(404).json({ error: 'Composed sheet not found' });
    }

    // Check if file exists
    if (!fs.existsSync(composedSheet.sheetPath)) {
      return res.status(404).json({ error: 'Sheet file not found on disk' });
    }

    // Generate download filename
    const ext = path.extname(composedSheet.sheetPath);
    const downloadName = `sheet_${composedSheet.layout.name}_${composedSheet.orientation}${ext}`;

    // Set headers and send file
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('Content-Type', 'image/jpeg');
    
    const fileStream = fs.createReadStream(composedSheet.sheetPath);
    fileStream.pipe(res);
    return; // Explicit return for file streaming

  } catch (error) {
    console.error('Sheet download error:', error);
    return res.status(500).json({ error: 'Failed to download sheet' });
  }
});

// Download PDF
router.get('/pdf/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const db = getDatabase();
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const job = await db.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if job has sheet composition enabled and PDF generation requested
    if (!job.options.sheetComposition?.enabled || !job.options.sheetComposition?.generatePDF) {
      return res.status(404).json({ error: 'PDF generation was not requested for this job' });
    }

    // Look for PDF file in processed directory
    const pdfPath = path.join(__dirname, '../../processed', `${jobId}.pdf`);
    
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: 'PDF file not found' });
    }

    // Generate download filename
    const downloadName = `processed_sheets_${jobId}.pdf`;

    // Set headers and send file
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('Content-Type', 'application/pdf');
    
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
    return; // Explicit return for file streaming

  } catch (error) {
    console.error('PDF download error:', error);
    return res.status(500).json({ error: 'Failed to download PDF' });
  }
});

// Download all processed content as ZIP
router.get('/zip/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const db = getDatabase();
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const job = await db.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Job is not completed yet' });
    }

    const processedImages = await db.getProcessedImagesByJobId(jobId);
    const composedSheets = await db.getComposedSheetsByJobId(jobId);
    const files = await db.getFilesByJobId(jobId);

    if (processedImages.length === 0 && composedSheets.length === 0) {
      return res.status(404).json({ error: 'No processed content found for this job' });
    }

    // Set response headers for ZIP download
    const downloadName = `processed_images_${jobId}.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('Content-Type', 'application/zip');

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create ZIP archive' });
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add processed images to ZIP
    for (const processedImage of processedImages) {
      if (fs.existsSync(processedImage.processedPath)) {
        // Find original file for naming
        const originalFile = files.find(f => f.id === processedImage.originalFileId);
        if (originalFile) {
          // Use the existing AI-generated filename directly in ZIP
          const aiGeneratedName = path.basename(processedImage.processedPath);
          const fileName = `processed_images/${aiGeneratedName}`;
          
          archive.file(processedImage.processedPath, { name: fileName });
        }
      }
    }

    // Add composed sheets to ZIP
    for (const sheet of composedSheets) {
      if (fs.existsSync(sheet.sheetPath)) {
        const ext = path.extname(sheet.sheetPath);
        const fileName = `composed_sheets/sheet_${sheet.layout.name}_${sheet.orientation}${ext}`;
        
        archive.file(sheet.sheetPath, { name: fileName });
      }
    }

    // Add PDF if it exists
    const pdfPath = path.join(__dirname, '../../processed', `${jobId}.pdf`);
    if (fs.existsSync(pdfPath)) {
      archive.file(pdfPath, { name: `processed_sheets_${jobId}.pdf` });
    }

    // Finalize the archive
  await archive.finalize();
  return; // Explicit return after streaming archive

  } catch (error) {
    console.error('ZIP download error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to create ZIP download' });
    }
    return;
  }
});

// Legacy batch download endpoint (redirect to ZIP)
router.get('/batch/:jobId', async (req: Request, res: Response) => {
  return res.redirect(`/api/download/zip/${req.params['jobId']}`);
});

// Get download status/metadata
router.get('/status/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const db = getDatabase();
    
    const job = await db.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const processedImages = await db.getProcessedImagesByJobId(jobId);
    const files = await db.getFilesByJobId(jobId);
    
    const downloadReady = job.status === 'completed' && processedImages.length > 0;
    
    return res.json({
      jobId: job.id,
      status: job.status,
      processedImages: processedImages.map(img => ({
        id: img.id,
        originalFileId: img.originalFileId,
        aspectRatio: img.aspectRatio,
        processingTime: img.processingTime,
        createdAt: img.createdAt
      })),
      totalFiles: files.length,
      processedCount: processedImages.length,
      downloadReady,
      completedAt: job.completedAt
    });

  } catch (error) {
    console.error('Download status error:', error);
    return res.status(500).json({ error: 'Failed to get download status' });
  }
});

export default router;