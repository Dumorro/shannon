/**
 * Git Repository URL Normalization
 * Epic 011: Git Repository Tracking for Scans
 *
 * Normalizes repository URLs to a canonical format for consistent storage and comparison.
 */

/**
 * Normalize repository URL
 * - Removes trailing .git suffix
 * - Removes trailing slashes
 * - Trims whitespace
 *
 * Examples:
 * - https://github.com/acme/repo.git → https://github.com/acme/repo
 * - https://github.com/acme/repo/   → https://github.com/acme/repo
 * - git@github.com:acme/repo.git    → git@github.com:acme/repo
 */
export function normalizeRepoUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  let normalized = url.trim();

  // Remove trailing .git suffix
  if (normalized.endsWith('.git')) {
    normalized = normalized.slice(0, -4);
  }

  // Remove trailing slashes
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Normalize branch name
 * - Trims whitespace
 * - Converts to lowercase for case-insensitive comparison (optional)
 */
export function normalizeBranchName(branch: string, lowercase = false): string {
  if (!branch || typeof branch !== 'string') {
    return '';
  }

  let normalized = branch.trim();

  if (lowercase) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}

/**
 * Compare two repository URLs for equality
 * Normalizes both URLs before comparison
 */
export function areRepoUrlsEqual(url1: string, url2: string): boolean {
  if (!url1 || !url2) return false;

  const normalized1 = normalizeRepoUrl(url1);
  const normalized2 = normalizeRepoUrl(url2);

  return normalized1 === normalized2;
}
