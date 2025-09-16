import fs from 'fs';
import path from 'path';

/**
 * Database Connection and Storage Management
 * 
 * Purpose: Handles all database operations including user authentication,
 * job management, and file storage with JSON-based persistence.
 * 
 * Updates:
 * - Added user authentication and session management
 * - Enhanced job operations with user association
 * - Added comprehensive user data management
 * 
 * Key Features:
 * - User registration and authentication
 * - Session management with token validation
 * - User-specific job history and data access
 * - Secure password handling integration points
 */

// Simple in-memory database for development
// In production, this would be replaced with a proper database like PostgreSQL or SQLite
interface DatabaseStore {
  users: Map<string, any>;
  userSessions: Map<string, any>;
  passwordResetTokens: Map<string, any>;
  jobs: Map<string, any>;
  files: Map<string, any>;
  processedImages: Map<string, any>;
  composedSheets: Map<string, any>;
}

class Database {
  private store: DatabaseStore;
  private dataFile: string;

  constructor() {
    this.dataFile = path.join(__dirname, '../../data/database.json');
    this.store = {
      users: new Map(),
      userSessions: new Map(),
      passwordResetTokens: new Map(),
      jobs: new Map(),
      files: new Map(),
      processedImages: new Map(),
      composedSheets: new Map()
    };
    this.loadData();
  }

  private loadData() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dataFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Load existing data if file exists
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        
        // Convert arrays back to Maps
        if (data.users) {
          this.store.users = new Map(data.users);
        }
        if (data.userSessions) {
          this.store.userSessions = new Map(data.userSessions);
        }
        if (data.passwordResetTokens) {
          this.store.passwordResetTokens = new Map(data.passwordResetTokens);
        }
        if (data.jobs) {
          this.store.jobs = new Map(data.jobs);
        }
        if (data.files) {
          this.store.files = new Map(data.files);
        }
        if (data.processedImages) {
          this.store.processedImages = new Map(data.processedImages);
        }
        if (data.composedSheets) {
          this.store.composedSheets = new Map(data.composedSheets);
        }
      }
    } catch (error) {
      console.error('Error loading database:', error);
      // Continue with empty store
    }
  }

  private saveData() {
    try {
      const data = {
        users: Array.from(this.store.users.entries()),
        userSessions: Array.from(this.store.userSessions.entries()),
        passwordResetTokens: Array.from(this.store.passwordResetTokens.entries()),
        jobs: Array.from(this.store.jobs.entries()),
        files: Array.from(this.store.files.entries()),
        processedImages: Array.from(this.store.processedImages.entries()),
        composedSheets: Array.from(this.store.composedSheets.entries())
      };
      
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  // User operations
  async createUser(user: any): Promise<void> {
    this.store.users.set(user.id, user);
    this.saveData();
  }

  async getUserById(userId: string): Promise<any | null> {
    return this.store.users.get(userId) || null;
  }

  async getUserByEmail(email: string): Promise<any | null> {
    const users = Array.from(this.store.users.values());
    return users.find(user => user.email === email) || null;
  }

  async getUserByUsername(username: string): Promise<any | null> {
    const users = Array.from(this.store.users.values());
    return users.find(user => user.username === username) || null;
  }

  async getUserByEmailOrUsername(emailOrUsername: string): Promise<any | null> {
    const users = Array.from(this.store.users.values());
    return users.find(user => 
      user.email === emailOrUsername || user.username === emailOrUsername
    ) || null;
  }

  async updateUser(userId: string, updates: Partial<any>): Promise<void> {
    const user = this.store.users.get(userId);
    if (user) {
      Object.assign(user, updates, { updatedAt: new Date() });
      this.store.users.set(userId, user);
      this.saveData();
    }
  }

  async deleteUser(userId: string): Promise<void> {
    this.store.users.delete(userId);
    this.saveData();
  }

  async isEmailTaken(email: string): Promise<boolean> {
    const user = await this.getUserByEmail(email);
    return user !== null;
  }

  async isUsernameTaken(username: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);
    return user !== null;
  }

  // User session operations
  async createUserSession(session: any): Promise<void> {
    this.store.userSessions.set(session.id, session);
    this.saveData();
  }

  async getUserSession(sessionId: string): Promise<any | null> {
    return this.store.userSessions.get(sessionId) || null;
  }

  async getUserSessionByToken(token: string): Promise<any | null> {
    const sessions = Array.from(this.store.userSessions.values());
    return sessions.find(session => 
      session.token === token && session.isActive && new Date() < new Date(session.expiresAt)
    ) || null;
  }

  async getUserSessionsByUserId(userId: string): Promise<any[]> {
    const sessions = Array.from(this.store.userSessions.values());
    return sessions.filter(session => session.userId === userId);
  }

  async updateUserSession(sessionId: string, updates: Partial<any>): Promise<void> {
    const session = this.store.userSessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      this.store.userSessions.set(sessionId, session);
      this.saveData();
    }
  }

  async deactivateUserSession(sessionId: string): Promise<void> {
    await this.updateUserSession(sessionId, { isActive: false });
  }

  async deactivateAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.getUserSessionsByUserId(userId);
    for (const session of sessions) {
      await this.updateUserSession(session.id, { isActive: false });
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    const sessions = Array.from(this.store.userSessions.entries());
    let hasChanges = false;

    for (const [sessionId, session] of sessions) {
      if (new Date() >= new Date(session.expiresAt)) {
        this.store.userSessions.delete(sessionId);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.saveData();
    }
  }

  // Password reset token operations
  async createPasswordResetToken(token: any): Promise<void> {
    this.store.passwordResetTokens.set(token.id, token);
    this.saveData();
  }

  async getPasswordResetToken(tokenId: string): Promise<any | null> {
    return this.store.passwordResetTokens.get(tokenId) || null;
  }

  async getPasswordResetTokenByToken(token: string): Promise<any | null> {
    const tokens = Array.from(this.store.passwordResetTokens.values());
    return tokens.find(t => 
      t.token === token && 
      !t.isUsed && 
      new Date() < new Date(t.expiresAt)
    ) || null;
  }

  async getPasswordResetTokensByUserId(userId: string): Promise<any[]> {
    const tokens = Array.from(this.store.passwordResetTokens.values());
    return tokens.filter(token => token.userId === userId);
  }

  async updatePasswordResetToken(tokenId: string, updates: Partial<any>): Promise<void> {
    const token = this.store.passwordResetTokens.get(tokenId);
    if (token) {
      Object.assign(token, updates);
      this.store.passwordResetTokens.set(tokenId, token);
      this.saveData();
    }
  }

  async markPasswordResetTokenAsUsed(tokenId: string): Promise<void> {
    await this.updatePasswordResetToken(tokenId, { 
      isUsed: true, 
      usedAt: new Date() 
    });
  }

  async cleanupExpiredPasswordResetTokens(): Promise<void> {
    const tokens = Array.from(this.store.passwordResetTokens.entries());
    let hasChanges = false;

    for (const [tokenId, token] of tokens) {
      if (new Date() >= new Date(token.expiresAt)) {
        this.store.passwordResetTokens.delete(tokenId);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.saveData();
    }
  }

  // Job operations (updated to support user association)
  async createJob(job: any): Promise<void> {
    this.store.jobs.set(job.id, job);
    this.saveData();
  }

  async getJob(jobId: string): Promise<any | null> {
    return this.store.jobs.get(jobId) || null;
  }

  async updateJob(jobId: string, updates: Partial<any>): Promise<void> {
    const job = this.store.jobs.get(jobId);
    if (job) {
      Object.assign(job, updates);
      this.store.jobs.set(jobId, job);
      this.saveData();
    }
  }

  async deleteJob(jobId: string): Promise<void> {
    this.store.jobs.delete(jobId);
    this.saveData();
  }

  // User-specific job operations
  async getJobsByUserId(userId: string): Promise<any[]> {
    const jobs = Array.from(this.store.jobs.values());
    return jobs.filter(job => job.userId === userId);
  }

  async getUserJobHistory(userId: string, limit?: number): Promise<any[]> {
    const jobs = await this.getJobsByUserId(userId);
    const sortedJobs = jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return limit ? sortedJobs.slice(0, limit) : sortedJobs;
  }

  async getUserJobCount(userId: string): Promise<number> {
    const jobs = await this.getJobsByUserId(userId);
    return jobs.length;
  }

  async getUserCompletedJobCount(userId: string): Promise<number> {
    const jobs = await this.getJobsByUserId(userId);
    return jobs.filter(job => job.status === 'completed').length;
  }

  // Check if user owns a specific job
  async userOwnsJob(userId: string, jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    return job !== null && job.userId === userId;
  }

  // File operations
  async createFile(file: any): Promise<void> {
    this.store.files.set(file.id, file);
    this.saveData();
  }

  async getFile(fileId: string): Promise<any | null> {
    return this.store.files.get(fileId) || null;
  }

  async getFilesByJobId(jobId: string): Promise<any[]> {
    const files = Array.from(this.store.files.values());
    return files.filter(file => file.jobId === jobId);
  }

  // Processed image operations
  async createProcessedImage(image: any): Promise<void> {
    this.store.processedImages.set(image.id, image);
    this.saveData();
  }

  async getProcessedImage(imageId: string): Promise<any | null> {
    return this.store.processedImages.get(imageId) || null;
  }

  async getProcessedImagesByJobId(jobId: string): Promise<any[]> {
    const images = Array.from(this.store.processedImages.values());
    return images.filter(image => image.jobId === jobId);
  }

  // Composed sheet operations
  async createComposedSheet(sheet: any): Promise<void> {
    this.store.composedSheets.set(sheet.id, sheet);
    this.saveData();
  }

  async getComposedSheet(sheetId: string): Promise<any | null> {
    return this.store.composedSheets.get(sheetId) || null;
  }

  async getComposedSheetsByJobId(jobId: string): Promise<any[]> {
    const sheets = Array.from(this.store.composedSheets.values());
    return sheets.filter(sheet => sheet.jobId === jobId);
  }

  // Cleanup operations
  async cleanupOldJobs(olderThanHours: number = 24): Promise<void> {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    // Also cleanup expired sessions and password reset tokens during maintenance
    await this.cleanupExpiredSessions();
    await this.cleanupExpiredPasswordResetTokens();
    
    for (const [jobId, job] of this.store.jobs.entries()) {
      if (new Date(job.createdAt) < cutoffTime) {
        // Clean up associated files, processed images, and composed sheets
        const files = await this.getFilesByJobId(jobId);
        const processedImages = await this.getProcessedImagesByJobId(jobId);
        const composedSheets = await this.getComposedSheetsByJobId(jobId);
        
        // Delete physical files
        for (const file of files) {
          try {
            if (fs.existsSync(file.uploadPath)) {
              fs.unlinkSync(file.uploadPath);
            }
          } catch (error) {
            console.error('Error deleting file:', file.uploadPath, error);
          }
        }
        
        for (const image of processedImages) {
          try {
            if (fs.existsSync(image.processedPath)) {
              fs.unlinkSync(image.processedPath);
            }
          } catch (error) {
            console.error('Error deleting processed image:', image.processedPath, error);
          }
        }
        
        for (const sheet of composedSheets) {
          try {
            if (fs.existsSync(sheet.sheetPath)) {
              fs.unlinkSync(sheet.sheetPath);
            }
          } catch (error) {
            console.error('Error deleting composed sheet:', sheet.sheetPath, error);
          }
        }
        
        // Remove from database
        this.store.jobs.delete(jobId);
        files.forEach(file => this.store.files.delete(file.id));
        processedImages.forEach(image => this.store.processedImages.delete(image.id));
        composedSheets.forEach(sheet => this.store.composedSheets.delete(sheet.id));
      }
    }
    
    this.saveData();
  }

  // Health check
  async isConnected(): Promise<boolean> {
    return true; // Always connected for in-memory database
  }

  // Test connection for health monitoring
  async testConnection(): Promise<void> {
    // For in-memory database, just verify we can access the store
    if (!this.store) {
      throw new Error('Database store is not initialized');
    }
    
    // Try to perform a simple operation
    const testKey = '__health_check__';
    this.store.jobs.set(testKey, { test: true });
    this.store.jobs.delete(testKey);
  }
}

// Singleton instance
let dbInstance: Database | null = null;

export function getDatabase(): Database {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
}

export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();
  console.log('Database initialized');
  
  // Set up periodic cleanup (every hour)
  setInterval(async () => {
    try {
      await db.cleanupOldJobs(24); // Clean up jobs older than 24 hours
    } catch (error) {
      console.error('Error during database cleanup:', error);
    }
  }, 60 * 60 * 1000); // Run every hour
}

export async function testConnection(): Promise<void> {
  const db = getDatabase();
  await db.testConnection();
}

export { Database };