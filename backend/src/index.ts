// Re-export all types, schemas, and utilities for easy access
export * from './types';
export * from './schemas';
export * from './utils/typeGuards';
export * from './utils/validation';
export * from './constants';

// CRITICAL: Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
import path from 'path';

// Try loading from both backend directory and project root
console.log('🔧 Loading .env from backend directory...');
dotenv.config({ path: path.join(__dirname, '../.env') });


console.log('🔧 Final GEMINI_API_KEY check:', process.env['GEMINI_API_KEY'] ? 'FOUND' : 'NOT FOUND');

// Express server setup
import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import { initializeDatabase } from './database/connection';
import { correlationIdMiddleware, logger } from './utils/logger';
import { errorHandlingMiddleware } from './utils/errorHandler';
import { healthMonitorService } from './services/healthMonitorService';
import healthRouter from './routes/health';

const app = express();
const PORT = process.env['PORT'] || 3001;

// Ensure upload directories exist
const UPLOAD_DIR = path.join(__dirname, '../uploads');
const PROCESSED_DIR = path.join(__dirname, '../processed');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(PROCESSED_DIR)) {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept only image files
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and TIFF files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Maximum 10 files per request
  }
});

// Middleware
app.use(correlationIdMiddleware());

app.use(cors({
  origin: [
    process.env['FRONTEND_URL'] || 'http://localhost:3000',
    'http://localhost:3002' // Frontend is now running on port 3002
  ],
  credentials: true,
  exposedHeaders: ['Content-Disposition'] // Allow frontend to access Content-Disposition header
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
import authRouter from './routes/auth';
import uploadRouter from './routes/upload';
import processingRouter from './routes/processing';
import downloadRouter from './routes/download';
import jobHistoryRouter from './routes/jobHistory';
import instagramAuthRouter from './routes/instagramAuth';
import instagramPostRouter from './routes/instagramPost';
import { debugRoutes } from './routes/debug';

// Health check routes
app.use('/health', healthRouter);

// Authentication routes
app.use('/api/auth', authRouter);

app.use('/api/upload', uploadRouter);
app.use('/api/processing', processingRouter);
app.use('/api/download', downloadRouter);
app.use('/api/job-history', jobHistoryRouter);
app.use('/api/instagram', instagramAuthRouter);
app.use('/api/instagram', instagramPostRouter);
app.use('/api/debug', debugRoutes);

// Error handling middleware
app.use(errorHandlingMiddleware());

// 404 handler
app.use('*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server only if this file is run directly
if (require.main === module) {
  // Initialize database before starting server
  initializeDatabase().then(() => {
    // Start health monitoring
    healthMonitorService.startMonitoring();
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        port: PORT,
        uploadDir: UPLOAD_DIR,
        processedDir: PROCESSED_DIR,
        environment: process.env['NODE_ENV'] || 'development'
      });
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      healthMonitorService.stopMonitoring();
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      healthMonitorService.stopMonitoring();
      process.exit(0);
    });
    
  }).catch((error) => {
    logger.error('Failed to initialize database', {}, error);
    process.exit(1);
  });
}

export { upload, UPLOAD_DIR, PROCESSED_DIR };
export default app;