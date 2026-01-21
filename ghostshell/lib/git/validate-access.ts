/**
 * Git Repository Validation and Size Estimation
 * Epic 011: Git Repository Tracking for Scans
 *
 * Validates repository access and estimates size using git ls-remote
 */

import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface RepositoryValidationResult {
  valid: boolean;
  error?:
    | 'AUTH_FAILED'
    | 'NOT_FOUND'
    | 'NETWORK_ERROR'
    | 'REPO_TOO_LARGE'
    | 'VALIDATION_TIMEOUT'
    | 'UNKNOWN';
  errorMessage?: string;
  estimatedSize?: number; // Size in bytes
  defaultBranch?: string;
  branches?: string[];
  duration: number; // Validation duration in milliseconds
}

const MAX_REPO_SIZE = 5 * 1024 * 1024 * 1024; // 5GB (FR-017)
const VALIDATION_TIMEOUT = 10000; // 10 seconds (SC-003, SC-009)

/**
 * Validate repository access using git ls-remote
 * Completes within 10 seconds per SC-003 and SC-009
 *
 * @param repoUrl - Repository URL (HTTPS or SSH)
 * @param credentialType - Type of credential ('PAT' or 'SSH')
 * @param credential - Personal Access Token or SSH private key
 * @returns Validation result with error categorization
 */
export async function validateRepositoryAccess(
  repoUrl: string,
  credentialType: 'PAT' | 'SSH',
  credential: string
): Promise<RepositoryValidationResult> {
  const startTime = Date.now();
  let sshKeyPath: string | undefined;

  try {
    let git: SimpleGit;
    let lsRemoteUrl: string;

    if (credentialType === 'PAT') {
      // PAT authentication: inject token into HTTPS URL
      if (!repoUrl.startsWith('https://')) {
        return {
          valid: false,
          error: 'UNKNOWN',
          errorMessage: 'PAT authentication requires HTTPS URL',
          duration: Date.now() - startTime,
        };
      }

      lsRemoteUrl = repoUrl.replace(
        'https://',
        `https://x-access-token:${credential}@`
      );

      const gitOptions: Partial<SimpleGitOptions> = {
        binary: 'git',
        maxConcurrentProcesses: 1,
        timeout: {
          block: VALIDATION_TIMEOUT,
        },
      };

      git = simpleGit(gitOptions);
    } else {
      // SSH authentication: use temporary key file
      if (!repoUrl.startsWith('git@')) {
        return {
          valid: false,
          error: 'UNKNOWN',
          errorMessage: 'SSH authentication requires SSH URL',
          duration: Date.now() - startTime,
        };
      }

      // Write SSH key to temporary file with strict permissions
      const tmpDir = os.tmpdir();
      sshKeyPath = path.join(
        tmpDir,
        `ssh-validate-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      await fs.writeFile(sshKeyPath, credential, { mode: 0o600 });

      lsRemoteUrl = repoUrl;

      const sshCommand = `ssh -i ${sshKeyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10`;

      const gitOptions: Partial<SimpleGitOptions> = {
        binary: 'git',
        maxConcurrentProcesses: 1,
        timeout: {
          block: VALIDATION_TIMEOUT,
        },
        config: [`core.sshCommand=${sshCommand}`],
      };

      git = simpleGit(gitOptions);
    }

    // Execute git ls-remote to validate access
    const lsRemote = await git.listRemote([
      '--heads',
      '--refs',
      lsRemoteUrl,
    ]);

    // Parse branches
    const branches: string[] = [];
    let defaultBranch: string | undefined;

    const lines = lsRemote.split('\n').filter((line) => line.trim());
    for (const line of lines) {
      const match = line.match(/^[a-f0-9]+\s+refs\/heads\/(.+)$/);
      if (match) {
        const branchName = match[1];
        branches.push(branchName);

        // Heuristic for default branch (main, master, develop)
        if (!defaultBranch) {
          if (['main', 'master', 'develop'].includes(branchName)) {
            defaultBranch = branchName;
          }
        }
      }
    }

    // Estimate repository size (naive approximation based on refs count)
    // Note: Actual size estimation would require cloning or using platform APIs
    const estimatedSize = branches.length * 10 * 1024 * 1024; // Very rough estimate

    // Clean up SSH key file if used
    if (sshKeyPath) {
      try {
        await fs.unlink(sshKeyPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    return {
      valid: true,
      estimatedSize,
      defaultBranch: defaultBranch || branches[0],
      branches,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    // Clean up SSH key file on error
    if (sshKeyPath) {
      try {
        await fs.unlink(sshKeyPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const duration = Date.now() - startTime;

    // Categorize error
    if (
      errorMessage.includes('Authentication failed') ||
      errorMessage.includes('Permission denied') ||
      errorMessage.includes('invalid credentials')
    ) {
      return {
        valid: false,
        error: 'AUTH_FAILED',
        errorMessage: 'Authentication failed. Please check your credentials.',
        duration,
      };
    }

    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('does not exist') ||
      errorMessage.includes('Could not resolve')
    ) {
      return {
        valid: false,
        error: 'NOT_FOUND',
        errorMessage: 'Repository not found. Please check the URL.',
        duration,
      };
    }

    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out') ||
      duration >= VALIDATION_TIMEOUT
    ) {
      return {
        valid: false,
        error: 'VALIDATION_TIMEOUT',
        errorMessage: 'Validation timed out after 10 seconds.',
        duration,
      };
    }

    if (
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('DNS') ||
      errorMessage.includes('ENOTFOUND')
    ) {
      return {
        valid: false,
        error: 'NETWORK_ERROR',
        errorMessage: 'Network error. Please check your connection.',
        duration,
      };
    }

    return {
      valid: false,
      error: 'UNKNOWN',
      errorMessage,
      duration,
    };
  }
}

/**
 * Estimate repository size using git ls-remote and validate 5GB limit
 * This is a simplified check - accurate size requires cloning or platform APIs
 *
 * @param repoUrl - Repository URL
 * @param credentialType - Credential type
 * @param credential - Authentication credential
 * @returns Validation result with size estimate
 */
export async function validateRepositorySize(
  repoUrl: string,
  credentialType: 'PAT' | 'SSH',
  credential: string
): Promise<RepositoryValidationResult> {
  const result = await validateRepositoryAccess(
    repoUrl,
    credentialType,
    credential
  );

  if (!result.valid) {
    return result;
  }

  // Check if estimated size exceeds limit
  if (result.estimatedSize && result.estimatedSize > MAX_REPO_SIZE) {
    return {
      ...result,
      valid: false,
      error: 'REPO_TOO_LARGE',
      errorMessage: `Repository size exceeds 5GB limit (estimated: ${Math.round(result.estimatedSize / (1024 * 1024 * 1024))}GB).`,
    };
  }

  return result;
}

/**
 * Quick validation check without size estimation
 * Useful for fast credential validation in UI
 */
export async function quickValidate(
  repoUrl: string,
  credentialType: 'PAT' | 'SSH',
  credential: string
): Promise<{ valid: boolean; error?: string }> {
  const result = await validateRepositoryAccess(
    repoUrl,
    credentialType,
    credential
  );

  return {
    valid: result.valid,
    error: result.error,
  };
}
