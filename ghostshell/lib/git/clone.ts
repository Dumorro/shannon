/**
 * Git Repository Cloning
 * Epic 011: Git Repository Tracking for Scans
 *
 * Handles cloning repositories with PAT and SSH authentication
 */

import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * T078: Redact credentials from error messages and logs.
 * Removes PAT tokens from HTTPS URLs and SSH key content.
 */
function redactCredentials(message: string): string {
  // Redact PAT tokens from HTTPS URLs
  let redacted = message.replace(
    /https:\/\/[^:]+:([^@]+)@/g,
    'https://x-access-token:[REDACTED]@'
  );

  // Redact SSH private key content (PEM format)
  redacted = redacted.replace(
    /-----BEGIN [A-Z ]+KEY-----[\s\S]*?-----END [A-Z ]+KEY-----/g,
    '-----BEGIN PRIVATE KEY-----[REDACTED]-----END PRIVATE KEY-----'
  );

  // Redact potential tokens in plain text
  redacted = redacted.replace(
    /\b(ghp_|gho_|github_pat_|glpat-)[A-Za-z0-9_-]{20,}\b/g,
    '$1[REDACTED]'
  );

  return redacted;
}

export interface CloneOptions {
  depth?: number; // Shallow clone depth (default: 1 for performance)
  branch?: string; // Specific branch to clone
  timeout?: number; // Clone timeout in milliseconds (default: 5 minutes)
}

// T075: Error categories for better diagnostics
export enum GitErrorType {
  AUTHENTICATION = 'AUTHENTICATION',
  NETWORK = 'NETWORK',
  INVALID_URL = 'INVALID_URL',
  TIMEOUT = 'TIMEOUT',
  REPOSITORY_NOT_FOUND = 'REPOSITORY_NOT_FOUND',
  UNKNOWN = 'UNKNOWN',
}

export interface CloneResult {
  success: boolean;
  repoPath?: string;
  commitHash?: string;
  branch?: string;
  error?: string;
  errorType?: GitErrorType; // T075: Categorized error type
  durationMs?: number;
}

/**
 * T075: Categorize git errors based on error message patterns
 * Provides specific error types for better diagnostics
 */
function categorizeGitError(error: Error): { type: GitErrorType; message: string } {
  const errorMessage = error.message.toLowerCase();

  // Authentication failures
  if (
    errorMessage.includes('authentication failed') ||
    errorMessage.includes('invalid credentials') ||
    errorMessage.includes('permission denied') ||
    errorMessage.includes('access denied') ||
    errorMessage.includes('authentication required') ||
    errorMessage.includes('401') ||
    errorMessage.includes('403 forbidden') ||
    errorMessage.includes('could not read from remote repository') ||
    errorMessage.includes('fatal: invalid credentials')
  ) {
    return {
      type: GitErrorType.AUTHENTICATION,
      message: 'Authentication failed. Please verify your credentials have the correct permissions for this repository.',
    };
  }

  // Network errors
  if (
    errorMessage.includes('could not resolve host') ||
    errorMessage.includes('failed to connect') ||
    errorMessage.includes('connection refused') ||
    errorMessage.includes('connection timed out') ||
    errorMessage.includes('network is unreachable') ||
    errorMessage.includes('temporary failure in name resolution') ||
    errorMessage.includes('enotfound') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('etimedout')
  ) {
    return {
      type: GitErrorType.NETWORK,
      message: 'Network error occurred. Please check your internet connection and verify the repository URL is accessible.',
    };
  }

  // Repository not found
  if (
    errorMessage.includes('repository not found') ||
    errorMessage.includes('404') ||
    errorMessage.includes('not found') ||
    errorMessage.includes("remote: repository '") ||
    errorMessage.includes('does not exist')
  ) {
    return {
      type: GitErrorType.REPOSITORY_NOT_FOUND,
      message: 'Repository not found. Please verify the repository URL is correct and you have access permissions.',
    };
  }

  // Timeout errors
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out') ||
    errorMessage.includes('operation too slow')
  ) {
    return {
      type: GitErrorType.TIMEOUT,
      message: 'Clone operation timed out. The repository may be too large or the network connection is too slow.',
    };
  }

  // Invalid URL format
  if (
    errorMessage.includes('invalid url') ||
    errorMessage.includes('malformed') ||
    errorMessage.includes('not a git repository')
  ) {
    return {
      type: GitErrorType.INVALID_URL,
      message: 'Invalid repository URL format. Please provide a valid HTTPS or SSH repository URL.',
    };
  }

  // Unknown error - return original message
  return {
    type: GitErrorType.UNKNOWN,
    message: `Clone failed: ${error.message}`,
  };
}

/**
 * Clone repository with Personal Access Token (PAT) authentication
 * Injects PAT into HTTPS URL for authentication
 *
 * @param repoUrl - HTTPS repository URL (e.g., https://github.com/owner/repo)
 * @param token - Personal Access Token (PAT)
 * @param targetDir - Target directory for clone
 * @param options - Clone options (depth, branch, timeout)
 */
export async function cloneWithPAT(
  repoUrl: string,
  token: string,
  targetDir: string,
  options: CloneOptions = {}
): Promise<CloneResult> {
  const startTime = Date.now();
  const { depth = 1, branch, timeout = 5 * 60 * 1000 } = options;

  try {
    // Validate inputs
    // T075: Improved error messages for invalid inputs
    if (!repoUrl || !repoUrl.startsWith('https://')) {
      return {
        success: false,
        error: 'Invalid HTTPS repository URL. PAT authentication requires an HTTPS URL (e.g., https://github.com/owner/repo)',
        errorType: GitErrorType.INVALID_URL,
      };
    }

    if (!token) {
      return {
        success: false,
        error: 'Personal Access Token (PAT) is required for authentication',
        errorType: GitErrorType.AUTHENTICATION,
      };
    }

    // Inject PAT into URL
    // Format: https://x-access-token:TOKEN@github.com/owner/repo
    // Or: https://oauth2:TOKEN@gitlab.com/owner/repo
    const authenticatedUrl = repoUrl.replace(
      'https://',
      `https://x-access-token:${token}@`
    );

    // Create target directory
    await fs.mkdir(targetDir, { recursive: true });

    // Configure git with timeout
    const gitOptions: Partial<SimpleGitOptions> = {
      baseDir: path.dirname(targetDir),
      binary: 'git',
      maxConcurrentProcesses: 1,
      timeout: {
        block: timeout,
      },
    };

    const git: SimpleGit = simpleGit(gitOptions);

    // Clone repository (shallow clone for performance)
    const cloneArgs: string[] = [];
    if (depth) {
      cloneArgs.push('--depth', String(depth));
    }
    if (branch) {
      cloneArgs.push('--branch', branch);
    }

    await git.clone(authenticatedUrl, targetDir, cloneArgs);

    // Get current commit hash
    const repoGit = simpleGit(targetDir);
    const log = await repoGit.log({ maxCount: 1 });
    const commitHash = log.latest?.hash;

    // Get current branch
    const branchSummary = await repoGit.branch();
    const currentBranch = branchSummary.current;

    return {
      success: true,
      repoPath: targetDir,
      commitHash,
      branch: currentBranch,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    // Clean up on failure
    try {
      await fs.rm(targetDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // T075: Categorize error for better diagnostics
    // T078: Redact credentials from error messages
    if (error instanceof Error) {
      const categorized = categorizeGitError(error);
      return {
        success: false,
        error: redactCredentials(categorized.message),
        errorType: categorized.type,
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: false,
      error: 'Unknown clone error',
      errorType: GitErrorType.UNKNOWN,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Clone repository with SSH key authentication
 * Uses GIT_SSH_COMMAND environment variable to specify SSH key
 *
 * @param repoUrl - SSH repository URL (e.g., git@github.com:owner/repo)
 * @param sshKey - SSH private key content (PEM format)
 * @param targetDir - Target directory for clone
 * @param options - Clone options (depth, branch, timeout)
 */
export async function cloneWithSSH(
  repoUrl: string,
  sshKey: string,
  targetDir: string,
  options: CloneOptions = {}
): Promise<CloneResult> {
  const startTime = Date.now();
  const { depth = 1, branch, timeout = 5 * 60 * 1000 } = options;

  let keyPath: string | undefined;

  try {
    // Validate inputs
    // T075: Improved error messages for invalid inputs
    if (!repoUrl || !repoUrl.startsWith('git@')) {
      return {
        success: false,
        error: 'Invalid SSH repository URL. SSH authentication requires an SSH URL (e.g., git@github.com:owner/repo.git)',
        errorType: GitErrorType.INVALID_URL,
      };
    }

    if (!sshKey) {
      return {
        success: false,
        error: 'SSH private key is required for authentication',
        errorType: GitErrorType.AUTHENTICATION,
      };
    }

    // Write SSH key to temporary file with strict permissions
    const tmpDir = os.tmpdir();
    keyPath = path.join(tmpDir, `ssh-key-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.writeFile(keyPath, sshKey, { mode: 0o600 });

    // Create target directory
    await fs.mkdir(targetDir, { recursive: true });

    // Configure git with custom SSH command
    const gitOptions: Partial<SimpleGitOptions> = {
      baseDir: path.dirname(targetDir),
      binary: 'git',
      maxConcurrentProcesses: 1,
      timeout: {
        block: timeout,
      },
    };

    const git: SimpleGit = simpleGit(gitOptions);

    // Set GIT_SSH_COMMAND to use the temporary key file
    // -o StrictHostKeyChecking=no: Skip host key verification (for automation)
    // -o UserKnownHostsFile=/dev/null: Don't save host keys
    const sshCommand = `ssh -i ${keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;

    // Clone repository with custom SSH command
    const cloneArgs: string[] = [
      '-c',
      `core.sshCommand=${sshCommand}`,
      'clone',
    ];

    if (depth) {
      cloneArgs.push('--depth', String(depth));
    }
    if (branch) {
      cloneArgs.push('--branch', branch);
    }

    cloneArgs.push(repoUrl, targetDir);

    await git.raw(cloneArgs);

    // Get current commit hash
    const repoGit = simpleGit(targetDir);
    const log = await repoGit.log({ maxCount: 1 });
    const commitHash = log.latest?.hash;

    // Get current branch
    const branchSummary = await repoGit.branch();
    const currentBranch = branchSummary.current;

    // Clean up SSH key file
    try {
      await fs.unlink(keyPath);
    } catch {
      // Ignore cleanup errors
    }

    return {
      success: true,
      repoPath: targetDir,
      commitHash,
      branch: currentBranch,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    // Clean up SSH key file on failure
    if (keyPath) {
      try {
        await fs.unlink(keyPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Clean up cloned directory on failure
    try {
      await fs.rm(targetDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // T075: Categorize error for better diagnostics
    // T078: Redact credentials from error messages
    if (error instanceof Error) {
      const categorized = categorizeGitError(error);
      return {
        success: false,
        error: redactCredentials(categorized.message),
        errorType: categorized.type,
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: false,
      error: 'Unknown clone error',
      errorType: GitErrorType.UNKNOWN,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Resolve commit hash from branch name
 * Useful when only branch name is provided (FR-005)
 *
 * @param repoPath - Path to cloned repository
 * @returns Full commit SHA-1 hash (40 chars)
 */
export async function resolveCommitHash(repoPath: string): Promise<string | null> {
  try {
    const git = simpleGit(repoPath);
    const log = await git.log({ maxCount: 1 });
    return log.latest?.hash || null;
  } catch (error) {
    // T078: Redact credentials from error messages before logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[clone] Failed to resolve commit hash:', redactCredentials(errorMessage));
    return null;
  }
}
