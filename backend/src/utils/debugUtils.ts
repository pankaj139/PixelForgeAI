/**
 * Debug Utilities for Image Processing System
 * 
 * This file contains debugging utilities to help diagnose and fix issues
 * in the image processing pipeline.
 * 
 * Usage:
 * ```typescript
 * import { debugUtils } from './debugUtils';
 * debugUtils.clearAINamingCache();
 * debugUtils.listRecentProcessedImages(5);
 * ```
 */

import fs from 'fs';
import path from 'path';
import { aiNamingService } from '../services/aiNamingService.js';
import { getDatabase } from '../database/connection.js';

export class DebugUtils {
  /**
   * Clear AI naming cache to ensure fresh analysis
   */
  clearAINamingCache(): void {
    aiNamingService.clearAllCache();
    console.log('✓ AI naming cache cleared');
  }

  /**
   * List recent processed images to check for duplicates
   */
  async listRecentProcessedImages(limit: number = 10): Promise<void> {
    const db = getDatabase();
    // Fallback if method not present (legacy environments)
    let recentImages: any[] = [];
    if (typeof (db as any).getRecentProcessedImages === 'function') {
      recentImages = await (db as any).getRecentProcessedImages(limit);
    } else {
      // Derive from all processed images grouped by job
      const all: any[] = [];
  // No legacy fallback derivation available without enumeration APIs
      recentImages = all.slice(0, limit);
    }
    
    console.log(`\n📋 Recent ${limit} processed images:`);
    console.log('─'.repeat(80));
    
    const pathCounts = new Map<string, number>();
    
    for (const image of recentImages) {
  const processedPath: string = image.processedPath;
  const count = pathCounts.get(processedPath) || 0;
      pathCounts.set(image.processedPath, count + 1);
      
      const duplicate = count > 0 ? ' 🚨 DUPLICATE!' : '';
  console.log(`${String(image.id).slice(0, 8)} | ${processedPath}${duplicate}`);
      
      if (processedPath && fs.existsSync(processedPath)) {
        const stats = fs.statSync(processedPath);
        console.log(`         Size: ${stats.size} bytes, Modified: ${stats.mtime.toISOString()}`);
      } else {
        console.log(`         ❌ FILE NOT FOUND`);
      }
    }
    
    // Report duplicates
    const duplicates = Array.from(pathCounts.entries()).filter(([, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log('\n🚨 Duplicate file paths found:');
      duplicates.forEach(([path, count]) => {
        console.log(`   ${count}x: ${path}`);
      });
    } else {
      console.log('\n✅ No duplicate file paths found');
    }
  }

  /**
   * Check processed directory for orphaned files
   */
  checkProcessedDirectory(): void {
    const processedDir = path.join(process.cwd(), 'processed');
    
    if (!fs.existsSync(processedDir)) {
      console.log('❌ Processed directory does not exist');
      return;
    }
    
    const files = fs.readdirSync(processedDir);
    console.log(`\n📁 Processed directory contains ${files.length} files:`);
    
    // Group by naming pattern
    const patterns = {
      aiGenerated: files.filter(f => /^[a-z_]+_[a-f0-9]{8}_/.test(f)),
      oldFormat: files.filter(f => /^processed_[a-f0-9-]+_/.test(f)),
      other: files.filter(f => !/^(processed_[a-f0-9-]+_|[a-z_]+_[a-f0-9]{8}_)/.test(f))
    };
    
    console.log(`   AI Generated: ${patterns.aiGenerated.length}`);
    console.log(`   Old Format: ${patterns.oldFormat.length}`);
    console.log(`   Other: ${patterns.other.length}`);
    
    if (patterns.aiGenerated.length > 0) {
      console.log('\n✅ New AI naming format detected:');
      patterns.aiGenerated.slice(0, 3).forEach(file => console.log(`   ${file}`));
      if (patterns.aiGenerated.length > 3) {
        console.log(`   ... and ${patterns.aiGenerated.length - 3} more`);
      }
    }
  }

  /**
   * Generate cache statistics
   */
  getAINamingCacheStats(): void {
    const stats = aiNamingService.getCacheStats();
    console.log('\n🧠 AI Naming Cache Stats:');
    console.log(`   Entries: ${stats.size}`);
    if (stats.size > 0) {
      console.log(`   Oldest: ${new Date(stats.oldestEntry).toISOString()}`);
      console.log(`   Newest: ${new Date(stats.newestEntry).toISOString()}`);
    }
  }
}

// Export singleton instance
export const debugUtils = new DebugUtils();
