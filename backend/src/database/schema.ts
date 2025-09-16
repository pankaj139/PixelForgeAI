/**
 * Database Schema Definitions
 * 
 * Purpose: Comprehensive schema definitions with Zod validation for all database entities
 * including user authentication, job processing, and file management.
 * 
 * Updates:
 * - Added user authentication schema with secure password handling
 * - Enhanced job schema to associate with users
 * - Added user session management capabilities
 * 
 * Key Features:
 * - Type-safe validation with Zod
 * - User authentication with encrypted passwords
 * - Job-user association for historical data
 * - Comprehensive security validation
 */

import { z } from 'zod';

// Database schema definitions using Zod for validation

// User authentication schema
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email('Invalid email format'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be less than 30 characters'),
  passwordHash: z.string().min(1, 'Password hash is required'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLoginAt: z.date().optional(),
  isActive: z.boolean().default(true),
  emailVerified: z.boolean().default(false),
  preferences: z.object({
    defaultAspectRatio: z.string().optional(),
    enableEmailNotifications: z.boolean().default(true),
    autoEnableFaceDetection: z.boolean().default(true),
    autoEnableAiNaming: z.boolean().default(true),
    theme: z.enum(['light', 'dark', 'auto']).default('light')
  }).optional()
});

// User registration input schema (without sensitive fields)
export const UserRegistrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50)
});

// User login schema
export const UserLoginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required')
});

// Forgot password schema
export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format')
});

// Reset password schema
export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number')
});

// JWT payload schema
export const JwtPayloadSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  username: z.string(),
  iat: z.number(),
  exp: z.number()
});

// User session schema
export const UserSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  token: z.string(),
  createdAt: z.date(),
  expiresAt: z.date(),
  isActive: z.boolean().default(true),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional()
});

// Password reset token schema
export const PasswordResetTokenSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  token: z.string(),
  createdAt: z.date(),
  expiresAt: z.date(),
  isUsed: z.boolean().default(false),
  usedAt: z.date().optional()
});

export const AspectRatioSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  name: z.string().min(1)
});

export const FileMetadataSchema = z.object({
  id: z.string().uuid(),
  originalName: z.string().min(1),
  size: z.number().positive(),
  mimeType: z.string().regex(/^image\/(jpeg|png|webp|tiff)$/),
  uploadPath: z.string().min(1),
  uploadedAt: z.date(),
  jobId: z.string().uuid().optional() // Added for database relations
});

export const GridLayoutSchema = z.object({
  rows: z.number().positive(),
  columns: z.number().positive(),
  name: z.string().min(1)
});

export const SheetCompositionOptionsSchema = z.object({
  enabled: z.boolean(),
  gridLayout: GridLayoutSchema,
  orientation: z.enum(['portrait', 'landscape']),
  generatePDF: z.boolean()
});

export const ProcessingOptionsSchema = z.object({
  aspectRatio: AspectRatioSchema,
  faceDetectionEnabled: z.boolean(),
  sheetComposition: SheetCompositionOptionsSchema.nullable(),
  aiNamingEnabled: z.boolean(),
  generateInstagramContent: z.boolean()
});

export const JobProgressSchema = z.object({
  currentStage: z.enum(['uploading', 'processing', 'composing', 'generating_pdf', 'completed']),
  processedImages: z.number().min(0),
  totalImages: z.number().min(0),
  percentage: z.number().min(0).max(100),
  stageProgress: z.object({
    processing: z.number().min(0).max(100).optional(),
    composing: z.number().min(0).max(100).optional(),
    generatingPdf: z.number().min(0).max(100).optional()
  }).optional()
});

export const JobSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(), // Associate job with user
  status: z.enum(['pending', 'processing', 'composing', 'generating_pdf', 'completed', 'failed', 'cancelled']),
  files: z.array(FileMetadataSchema),
  options: ProcessingOptionsSchema,
  createdAt: z.date(),
  completedAt: z.date().optional(),
  progress: JobProgressSchema,
  errorMessage: z.string().optional(),
  isPublic: z.boolean().default(false), // Allow users to make jobs public for sharing
  title: z.string().optional() // Optional user-defined title for the job
});

export const BoundingBoxSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive()
});

export const DetectionResultSchema = z.object({
  faces: z.array(z.object({
    boundingBox: BoundingBoxSchema,
    confidence: z.number().min(0).max(1),
    landmarks: z.array(z.object({
      x: z.number(),
      y: z.number()
    })).optional()
  })),
  people: z.array(z.object({
    boundingBox: BoundingBoxSchema,
    confidence: z.number().min(0).max(1),
    keypoints: z.array(z.object({
      x: z.number(),
      y: z.number(),
      confidence: z.number().min(0).max(1)
    })).optional()
  })),
  confidence: z.number().min(0).max(1)
});

export const CropAreaSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
  confidence: z.number().min(0).max(1)
});

const InstagramContentSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
  generatedAt: z.string()
}).optional();

export const ProcessedImageSchema = z.object({
  id: z.string().uuid(),
  originalFileId: z.string().uuid(),
  jobId: z.string().uuid(),
  processedPath: z.string().min(1),
  cropArea: CropAreaSchema,
  aspectRatio: AspectRatioSchema,
  detections: DetectionResultSchema,
  processingTime: z.number().positive(),
  instagramContent: InstagramContentSchema,
  createdAt: z.date()
});

export const ComposedSheetSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  sheetPath: z.string().min(1),
  layout: GridLayoutSchema,
  orientation: z.enum(['portrait', 'landscape']),
  images: z.array(ProcessedImageSchema),
  emptySlots: z.number().min(0),
  createdAt: z.date()
});

// Type exports for TypeScript
export type User = z.infer<typeof UserSchema>;
export type UserRegistration = z.infer<typeof UserRegistrationSchema>;
export type UserLogin = z.infer<typeof UserLoginSchema>;
export type ForgotPassword = z.infer<typeof ForgotPasswordSchema>;
export type ResetPassword = z.infer<typeof ResetPasswordSchema>;
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;
export type UserSession = z.infer<typeof UserSessionSchema>;
export type PasswordResetToken = z.infer<typeof PasswordResetTokenSchema>;
export type AspectRatio = z.infer<typeof AspectRatioSchema>;
export type FileMetadata = z.infer<typeof FileMetadataSchema>;
export type Job = z.infer<typeof JobSchema>;
export type JobProgress = z.infer<typeof JobProgressSchema>;
export type ProcessingOptions = z.infer<typeof ProcessingOptionsSchema>;
export type GridLayout = z.infer<typeof GridLayoutSchema>;
export type SheetCompositionOptions = z.infer<typeof SheetCompositionOptionsSchema>;
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;
export type DetectionResult = z.infer<typeof DetectionResultSchema>;
export type CropArea = z.infer<typeof CropAreaSchema>;
export type ProcessedImage = z.infer<typeof ProcessedImageSchema>;
export type ComposedSheet = z.infer<typeof ComposedSheetSchema>;

// Validation functions
export function validateUser(data: unknown): User {
  return UserSchema.parse(data);
}

export function validateUserRegistration(data: unknown): UserRegistration {
  return UserRegistrationSchema.parse(data);
}

export function validateUserLogin(data: unknown): UserLogin {
  return UserLoginSchema.parse(data);
}

export function validateForgotPassword(data: unknown): ForgotPassword {
  return ForgotPasswordSchema.parse(data);
}

export function validateResetPassword(data: unknown): ResetPassword {
  return ResetPasswordSchema.parse(data);
}

export function validateJwtPayload(data: unknown): JwtPayload {
  return JwtPayloadSchema.parse(data);
}

export function validateUserSession(data: unknown): UserSession {
  return UserSessionSchema.parse(data);
}

export function validateJob(data: unknown): Job {
  return JobSchema.parse(data);
}

export function validateFileMetadata(data: unknown): FileMetadata {
  return FileMetadataSchema.parse(data);
}

export function validateProcessedImage(data: unknown): ProcessedImage {
  return ProcessedImageSchema.parse(data);
}

export function validateAspectRatio(data: unknown): AspectRatio {
  return AspectRatioSchema.parse(data);
}

export function validateProcessingOptions(data: unknown): ProcessingOptions {
  return ProcessingOptionsSchema.parse(data);
}

export function validateComposedSheet(data: unknown): ComposedSheet {
  return ComposedSheetSchema.parse(data);
}

export function validateJobProgress(data: unknown): JobProgress {
  return JobProgressSchema.parse(data);
}

// Database table creation (for future SQL database migration)
export const CREATE_TABLES_SQL = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(30) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  preferences JSONB DEFAULT '{}'
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  user_agent TEXT,
  ip_address VARCHAR(45)
);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMP
);

-- Jobs table (updated with user association)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'composing', 'generating_pdf', 'completed', 'failed', 'cancelled')),
  aspect_ratio_width INTEGER NOT NULL,
  aspect_ratio_height INTEGER NOT NULL,
  aspect_ratio_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  title VARCHAR(255)
);

-- Files table
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  original_name VARCHAR(255) NOT NULL,
  size BIGINT NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  upload_path TEXT NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Processed images table
CREATE TABLE IF NOT EXISTS processed_images (
  id UUID PRIMARY KEY,
  original_file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  processed_path TEXT NOT NULL,
  crop_area_x INTEGER NOT NULL,
  crop_area_y INTEGER NOT NULL,
  crop_area_width INTEGER NOT NULL,
  crop_area_height INTEGER NOT NULL,
  crop_area_confidence DECIMAL(3,2) NOT NULL,
  detections JSONB,
  processing_time INTEGER NOT NULL,
  instagram_content JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Composed sheets table
CREATE TABLE IF NOT EXISTS composed_sheets (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sheet_path TEXT NOT NULL,
  layout_rows INTEGER NOT NULL,
  layout_columns INTEGER NOT NULL,
  layout_name VARCHAR(50) NOT NULL,
  orientation VARCHAR(20) NOT NULL CHECK (orientation IN ('portrait', 'landscape')),
  empty_slots INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_public ON jobs(is_public);
CREATE INDEX IF NOT EXISTS idx_files_job_id ON files(job_id);
CREATE INDEX IF NOT EXISTS idx_processed_images_job_id ON processed_images(job_id);
CREATE INDEX IF NOT EXISTS idx_processed_images_file_id ON processed_images(original_file_id);
CREATE INDEX IF NOT EXISTS idx_composed_sheets_job_id ON composed_sheets(job_id);
`;