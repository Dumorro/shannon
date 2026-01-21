/**
 * Git Repository Cleanup
 * Epic 011: Git Repository Tracking for Scans
 *
 * Handles deletion of cloned repositories after scan completion (within 5 minutes per SC-008)
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface CleanupResult {
  success: boolean;
  error?: string;
  deletedPath?: string;
  durationMs?: number;
}

/**
 * Delete a cloned repository directory
 * Recursively removes the directory and all contents
 *
 * @param repoPath - Absolute path to the cloned repository directory
 * @returns Cleanup result with success status
 */
export async function cleanupRepository(
  repoPath: string
): Promise<CleanupResult> {
  const startTime = Date.now();

  try {
    // Validate input
    if (!repoPath || typeof repoPath !== 'string') {
      return {
        success: false,
        error: 'Repository path is required',
      };
    }

    // Ensure absolute path
    const absolutePath = path.isAbsolute(repoPath)
      ? repoPath
      : path.resolve(repoPath);

    // Safety check: Ensure path contains expected patterns to avoid accidental deletion
    // Repository clones should be in a temporary directory
    const isSafePath =
      absolutePath.includes('/tmp/') ||
      absolutePath.includes('/temp/') ||
      absolutePath.includes('scan-repos') ||
      absolutePath.includes('cloned-repos');

    if (!isSafePath) {
      return {
        success: false,
        error: `Refusing to delete directory outside safe paths: ${absolutePath}`,
      };
    }

    // Check if path exists
    try {
      await fs.access(absolutePath);
    } catch {
      // Path doesn't exist - consider this a success (idempotent cleanup)
      return {
        success: true,
        deletedPath: absolutePath,
        durationMs: Date.now() - startTime,
      };
    }

    // Delete the directory recursively
    await fs.rm(absolutePath, { recursive: true, force: true });

    return {
      success: true,
      deletedPath: absolutePath,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown cleanup error',
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Schedule automatic cleanup after a delay
 * Useful for ensuring cleanup happens even if the main process is interrupted
 *
 * @param repoPath - Absolute path to the cloned repository directory
 * @param delayMs - Delay in milliseconds before cleanup (default: 5 minutes per SC-008)
 */
export function scheduleCleanup(
  repoPath: string,
  delayMs: number = 5 * 60 * 1000
): NodeJS.Timeout {
  return setTimeout(async () => {
    const result = await cleanupRepository(repoPath);
    if (!result.success) {
      console.error(
        `[cleanup] Failed to cleanup repository at ${repoPath}:`,
        result.error
      );
    } else {
      console.log(`[cleanup] Successfully cleaned up repository at ${repoPath}`);
    }
  }, delayMs);
}
