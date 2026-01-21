/**
 * Code Snippet Extraction
 * Epic 011: Git Repository Tracking for Scans
 *
 * Extracts code snippets with context for security findings
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface CodeLocation {
  filePath: string; // Relative path from repository root
  lineNumber: number; // Line number where issue occurs (1-indexed)
  codeSnippet: string; // Multi-line string with context
  startLine: number; // First line number in snippet
  endLine: number; // Last line number in snippet
  repositoryUrl: string;
  commitHash: string;
  branch?: string;
}

export interface SnippetExtractionOptions {
  contextLines?: number; // Number of lines before/after target line (default: 2)
  maxFileSize?: number; // Maximum file size in bytes (default: 10MB)
}

/**
 * Extract code snippet from a file with surrounding context
 *
 * @param repoPath - Absolute path to cloned repository root
 * @param filePath - Relative path to file within repository
 * @param lineNumber - Target line number (1-indexed)
 * @param repositoryUrl - Repository URL for traceability
 * @param commitHash - Commit hash for reproducibility
 * @param branch - Optional branch name
 * @param options - Extraction options (contextLines, maxFileSize)
 * @returns CodeLocation with snippet, or null if extraction fails
 */
export async function extractCodeSnippet(
  repoPath: string,
  filePath: string,
  lineNumber: number,
  repositoryUrl: string,
  commitHash: string,
  branch?: string,
  options: SnippetExtractionOptions = {}
): Promise<CodeLocation | null> {
  const {
    contextLines = 2,
    maxFileSize = 10 * 1024 * 1024, // 10MB default
  } = options;

  try {
    // Construct full path
    const fullPath = path.join(repoPath, filePath);

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      console.warn(`[snippet] File not found: ${fullPath}`);
      return null;
    }

    // Check file stats
    const stats = await fs.stat(fullPath);

    // Skip directories
    if (stats.isDirectory()) {
      console.warn(`[snippet] Path is a directory: ${fullPath}`);
      return null;
    }

    // Skip large files (>10MB by default)
    if (stats.size > maxFileSize) {
      console.warn(
        `[snippet] File too large (${stats.size} bytes): ${fullPath}`
      );
      return null;
    }

    // Read first few bytes to detect binary files
    const buffer = Buffer.alloc(Math.min(8000, stats.size));
    const fd = await fs.open(fullPath, 'r');
    await fd.read(buffer, 0, buffer.length, 0);
    await fd.close();

    // Check for null bytes (binary file indicator)
    if (buffer.includes(0)) {
      console.warn(`[snippet] Binary file detected: ${fullPath}`);
      return null;
    }

    // Read file content as UTF-8
    let content: string;
    try {
      content = await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      console.warn(
        `[snippet] Failed to read as UTF-8: ${fullPath}`,
        error
      );
      return null;
    }

    // Split into lines
    const lines = content.split('\n');

    // Validate line number
    if (lineNumber < 1 || lineNumber > lines.length) {
      console.warn(
        `[snippet] Line number ${lineNumber} out of range (1-${lines.length}): ${fullPath}`
      );

      // If line number exceeds file length, return last 5 lines as fallback
      if (lineNumber > lines.length) {
        const startIndex = Math.max(0, lines.length - 5);
        const snippetLines = lines.slice(startIndex);
        return {
          filePath,
          lineNumber: lines.length,
          codeSnippet: snippetLines.join('\n'),
          startLine: startIndex + 1,
          endLine: lines.length,
          repositoryUrl,
          commitHash,
          branch,
        };
      }

      return null;
    }

    // Calculate snippet range (convert 1-indexed to 0-indexed)
    const targetIndex = lineNumber - 1;
    const startIndex = Math.max(0, targetIndex - contextLines);
    const endIndex = Math.min(lines.length - 1, targetIndex + contextLines);

    // Extract snippet
    const snippetLines = lines.slice(startIndex, endIndex + 1);
    const snippet = snippetLines.join('\n');

    return {
      filePath,
      lineNumber,
      codeSnippet: snippet,
      startLine: startIndex + 1,
      endLine: endIndex + 1,
      repositoryUrl,
      commitHash,
      branch,
    };
  } catch (error) {
    console.error(
      `[snippet] Unexpected error extracting snippet from ${filePath}:`,
      error
    );
    return null;
  }
}

/**
 * Batch extract multiple code snippets
 * Useful for extracting snippets for multiple findings at once
 */
export async function extractCodeSnippets(
  repoPath: string,
  locations: Array<{
    filePath: string;
    lineNumber: number;
  }>,
  repositoryUrl: string,
  commitHash: string,
  branch?: string,
  options?: SnippetExtractionOptions
): Promise<Map<string, CodeLocation | null>> {
  const results = new Map<string, CodeLocation | null>();

  for (const location of locations) {
    const key = `${location.filePath}:${location.lineNumber}`;
    const snippet = await extractCodeSnippet(
      repoPath,
      location.filePath,
      location.lineNumber,
      repositoryUrl,
      commitHash,
      branch,
      options
    );
    results.set(key, snippet);
  }

  return results;
}
