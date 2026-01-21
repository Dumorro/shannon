/**
 * Code Snippet Processor for Findings
 * Epic 011: Git Repository Tracking for Scans
 *
 * Post-processes findings to extract code snippets from referenced files
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface CodeLocation {
  filePath: string; // Relative path from repository root
  lineNumber: number; // Line number where issue occurs (1-indexed)
  codeSnippet: string; // Multi-line string with context
  startLine: number; // First line number in snippet
  endLine: number; // Last line number in snippet
  repositoryUrl?: string;
  commitHash?: string;
  branch?: string;
}

export interface FindingWithEvidence {
  title: string;
  description: string;
  severity: string;
  category: string;
  evidence?: Record<string, unknown>;
  // Finding may reference file path and line number
  filePath?: string;
  lineNumber?: number;
}

/**
 * Extract code snippet from a file with surrounding context
 * (T042-T044: Handle binary, large files, and encoding errors)
 */
async function extractCodeSnippet(
  repoPath: string,
  filePath: string,
  lineNumber: number,
  contextLines: number = 2
): Promise<string | null> {
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

    // T043: Skip large files (>10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (stats.size > MAX_FILE_SIZE) {
      console.warn(`[snippet] File too large (${stats.size} bytes): ${fullPath}`);
      return null;
    }

    // T042: Read first few bytes to detect binary files
    const buffer = Buffer.alloc(Math.min(8000, stats.size));
    const fd = await fs.open(fullPath, 'r');
    await fd.read(buffer, 0, buffer.length, 0);
    await fd.close();

    // Check for null bytes (binary file indicator)
    if (buffer.includes(0)) {
      console.warn(`[snippet] Binary file detected: ${fullPath}`);
      return null;
    }

    // T044: Read file content as UTF-8 with error handling
    let content: string;
    try {
      content = await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      console.warn(`[snippet] Failed to read as UTF-8: ${fullPath}`, error);
      return null;
    }

    // Split into lines
    const lines = content.split('\n');

    // Validate line number
    if (lineNumber < 1 || lineNumber > lines.length) {
      console.warn(`[snippet] Line number ${lineNumber} out of range (1-${lines.length}): ${fullPath}`);

      // If line number exceeds file length, return last 5 lines as fallback
      if (lineNumber > lines.length) {
        const startIndex = Math.max(0, lines.length - 5);
        const snippetLines = lines.slice(startIndex);
        return snippetLines.join('\n');
      }

      return null;
    }

    // Calculate snippet range (convert 1-indexed to 0-indexed)
    const targetIndex = lineNumber - 1;
    const startIndex = Math.max(0, targetIndex - contextLines);
    const endIndex = Math.min(lines.length - 1, targetIndex + contextLines);

    // Extract snippet
    const snippetLines = lines.slice(startIndex, endIndex + 1);
    return snippetLines.join('\n');
  } catch (error) {
    console.error(`[snippet] Unexpected error extracting snippet from ${filePath}:`, error);
    return null;
  }
}

/**
 * T040-T041: Process finding to add code snippet to evidence field
 *
 * Looks for file path and line number in finding data and extracts code snippet
 */
export async function processFindingWithCodeSnippet(
  finding: FindingWithEvidence,
  repoPath: string,
  repositoryUrl?: string,
  commitHash?: string,
  branch?: string
): Promise<FindingWithEvidence> {
  // Try to find file path and line number from finding
  const filePath = finding.filePath || finding.evidence?.filePath as string | undefined;
  const lineNumber = finding.lineNumber || finding.evidence?.lineNumber as number | undefined;

  if (!filePath || !lineNumber) {
    // No file path or line number - return finding as-is
    return finding;
  }

  // Extract code snippet
  const codeSnippet = await extractCodeSnippet(repoPath, filePath, lineNumber);

  if (!codeSnippet) {
    // Failed to extract snippet - return finding as-is
    return finding;
  }

  // Calculate context lines
  const contextLines = 2;
  const targetIndex = lineNumber - 1;
  const content = codeSnippet.split('\n');
  const startLine = Math.max(1, lineNumber - contextLines);
  const endLine = Math.min(lineNumber + contextLines, startLine + content.length - 1);

  // T041: Add codeLocation to evidence field
  const codeLocation: CodeLocation = {
    filePath,
    lineNumber,
    codeSnippet,
    startLine,
    endLine,
    repositoryUrl,
    commitHash,
    branch,
  };

  return {
    ...finding,
    evidence: {
      ...finding.evidence,
      codeLocation,
    },
  };
}

/**
 * Process multiple findings in batch
 */
export async function processFindingsWithCodeSnippets(
  findings: FindingWithEvidence[],
  repoPath: string,
  repositoryUrl?: string,
  commitHash?: string,
  branch?: string
): Promise<FindingWithEvidence[]> {
  const processed: FindingWithEvidence[] = [];

  for (const finding of findings) {
    const processedFinding = await processFindingWithCodeSnippet(
      finding,
      repoPath,
      repositoryUrl,
      commitHash,
      branch
    );
    processed.push(processedFinding);
  }

  return processed;
}
