/**
 * Git Repository URL Validation
 * Epic 011: Git Repository Tracking for Scans
 */

// Supported repository URL formats:
// HTTPS: https://github.com/owner/repo
// HTTPS: https://gitlab.com/owner/repo
// HTTPS: https://bitbucket.org/owner/repo
// SSH: git@github.com:owner/repo
// SSH: git@gitlab.com:owner/repo.git

const HTTPS_REPO_REGEX = /^https:\/\/[\w\.\-]+(\/[\w\.\-]+)+$/;
const SSH_REPO_REGEX = /^git@[\w\.\-]+:[\w\.\-\/]+$/;
const COMMIT_HASH_REGEX = /^[a-f0-9]{40}$/;

export interface ValidationResult {
  valid: boolean;
  error?: string;
  type?: 'https' | 'ssh';
}

/**
 * Validate repository URL format
 * Supports HTTPS and SSH formats from GitHub, GitLab, Bitbucket, and self-hosted Git servers
 */
export function validateRepositoryUrl(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      error: 'Repository URL is required',
    };
  }

  const trimmed = url.trim();

  // Check HTTPS format
  if (trimmed.startsWith('https://')) {
    if (HTTPS_REPO_REGEX.test(trimmed)) {
      return {
        valid: true,
        type: 'https',
      };
    }
    return {
      valid: false,
      error:
        'Invalid HTTPS repository URL format. Expected: https://host.com/owner/repo',
    };
  }

  // Check SSH format
  if (trimmed.startsWith('git@')) {
    if (SSH_REPO_REGEX.test(trimmed)) {
      return {
        valid: true,
        type: 'ssh',
      };
    }
    return {
      valid: false,
      error: 'Invalid SSH repository URL format. Expected: git@host.com:owner/repo',
    };
  }

  return {
    valid: false,
    error:
      'Unsupported repository URL format. Must be HTTPS (https://...) or SSH (git@...)',
  };
}

/**
 * Validate commit hash format
 * Commit hashes must be full SHA-1 hashes (40 hexadecimal characters)
 */
export function validateCommitHash(hash: string): boolean {
  if (!hash || typeof hash !== 'string') {
    return false;
  }
  return COMMIT_HASH_REGEX.test(hash.trim());
}

/**
 * Validate branch name format
 * Basic validation for git branch names
 * See: https://git-scm.com/docs/git-check-ref-format
 */
export function validateBranchName(branch: string): boolean {
  if (!branch || typeof branch !== 'string') {
    return false;
  }

  const trimmed = branch.trim();

  // Basic constraints:
  // - Must not be empty
  // - Must not exceed 255 characters (practical limit)
  // - Must not contain certain special characters
  if (
    trimmed.length === 0 ||
    trimmed.length > 255 ||
    trimmed.includes('..') ||
    trimmed.includes(' ') ||
    trimmed.startsWith('/') ||
    trimmed.endsWith('/') ||
    trimmed.endsWith('.lock')
  ) {
    return false;
  }

  return true;
}

/**
 * Detect repository URL type (HTTPS or SSH)
 */
export function detectUrlType(url: string): 'https' | 'ssh' | null {
  if (!url) return null;

  const trimmed = url.trim();
  if (trimmed.startsWith('https://')) return 'https';
  if (trimmed.startsWith('git@')) return 'ssh';

  return null;
}
