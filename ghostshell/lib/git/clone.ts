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

export interface CloneOptions {
  depth?: number; // Shallow clone depth (default: 1 for performance)
  branch?: string; // Specific branch to clone
  timeout?: number; // Clone timeout in milliseconds (default: 5 minutes)
}

export interface CloneResult {
  success: boolean;
  repoPath?: string;
  commitHash?: string;
  branch?: string;
  error?: string;
  durationMs?: number;
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
    if (!repoUrl || !repoUrl.startsWith('https://')) {
      return {
        success: false,
        error: 'Invalid HTTPS repository URL',
      };
    }

    if (!token) {
      return {
        success: false,
        error: 'Personal Access Token (PAT) is required',
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

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown clone error',
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
    if (!repoUrl || !repoUrl.startsWith('git@')) {
      return {
        success: false,
        error: 'Invalid SSH repository URL',
      };
    }

    if (!sshKey) {
      return {
        success: false,
        error: 'SSH private key is required',
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

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown clone error',
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
    console.error('[clone] Failed to resolve commit hash:', error);
    return null;
  }
}
