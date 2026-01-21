/**
 * TypeScript Types for Git Repository Tracking
 * Epic 011: Git Repository Tracking for Scans
 */

/**
 * Code location within a repository for security findings
 * Embedded in Finding.evidence JSON field
 */
export interface CodeLocation {
  filePath: string; // Relative path from repository root
  lineNumber: number; // Line number where issue occurs (1-indexed)
  codeSnippet: string; // Multi-line string with 5 lines of context
  startLine: number; // First line number in snippet
  endLine: number; // Last line number in snippet
  repositoryUrl: string; // Repository URL for traceability
  commitHash: string; // Exact commit SHA-1 hash for reproducibility
  branch?: string; // Optional branch name
}

/**
 * Finding evidence with optional code location
 * Extends existing Finding.evidence JSON structure
 */
export interface FindingEvidence {
  // Existing fields
  description?: string;
  reproductionSteps?: string[];
  affectedUrls?: string[];
  requestResponse?: {
    request: string;
    response: string;
  };

  // New: Code location with snippet (Epic 011)
  codeLocation?: CodeLocation;
}

/**
 * Repository validation result
 * Returned by validation endpoint and validation functions
 */
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

/**
 * Credential type enum
 * Matches Prisma enum CredentialType
 */
export type CredentialType = 'PAT' | 'SSH';

/**
 * Input for creating repository credentials
 * Used by POST /api/repository-credentials
 */
export interface CreateCredentialInput {
  organizationId: string;
  repositoryUrl: string; // Will be normalized before storage
  credentialType: CredentialType;
  credential: string; // Plain text (will be encrypted)
  createdBy: string; // User ID
}

/**
 * Input for updating repository credentials
 * Used by PATCH /api/repository-credentials/[id]
 */
export interface UpdateCredentialInput {
  credential?: string; // New credential (plain text, will be encrypted)
  validationStatus?: 'valid' | 'invalid' | 'untested';
}

/**
 * Repository credential response (without decrypted secret)
 * Returned by GET /api/repository-credentials
 */
export interface RepositoryCredentialResponse {
  id: string;
  organizationId: string;
  repositoryUrl: string;
  credentialType: CredentialType;
  createdAt: string; // ISO 8601 datetime
  updatedAt: string;
  createdBy: string;
  lastValidatedAt?: string;
  validationStatus?: 'valid' | 'invalid' | 'untested';
  // encryptedCredential is never included in responses for security
}

/**
 * Input for creating a scan with repository information
 * Used by POST /api/scans
 */
export interface CreateScanInput {
  projectId: string;

  // Repository overrides (optional, inherits from project defaults if not provided)
  repositoryUrl?: string; // Override project default
  repositoryBranch?: string; // Override project default
  repositoryCommitHash?: string; // Optional: scan specific commit

  // Other scan fields (existing)
  source?: 'MANUAL' | 'SCHEDULED' | 'CICD' | 'API';
  metadata?: Record<string, unknown>;
}

/**
 * Scan response with repository information
 * Returned by GET /api/scans/[id]
 */
export interface ScanResponse {
  id: string;
  organizationId: string;
  projectId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';
  source: 'MANUAL' | 'SCHEDULED' | 'CICD' | 'API';

  // Repository information (Epic 011)
  repositoryUrl?: string;
  repositoryBranch?: string;
  repositoryCommitHash?: string;

  // Timing
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;

  // Progress
  currentPhase?: string;
  currentAgent?: string;
  progressPercent: number;

  // Results summary
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;

  // Error handling
  errorMessage?: string;
  errorCode?: string;

  // Metadata
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for validating repository credentials
 * Used by POST /api/repository-credentials/validate
 */
export interface ValidateCredentialInput {
  repositoryUrl: string;
  credentialType: CredentialType;
  credential: string; // Plain text credential
}

/**
 * Response from credential validation
 * Returned by POST /api/repository-credentials/validate
 */
export interface ValidateCredentialResponse {
  valid: boolean;
  error?: string;
  errorMessage?: string;
  branches?: string[];
  defaultBranch?: string;
  duration: number;
}

/**
 * Input for updating project repository defaults
 * Used by PATCH /api/projects/[id]
 */
export interface UpdateProjectRepositoryInput {
  defaultRepositoryUrl?: string;
  defaultRepositoryBranch?: string;
}

/**
 * Repository configuration for scan execution
 * Used internally by Shannon workers
 */
export interface RepositoryConfig {
  url: string;
  branch?: string;
  commitHash?: string;
  credentialType: CredentialType;
  credential: string; // Decrypted credential (never logged)
}

/**
 * Git clone result
 * Returned by clone functions
 */
export interface CloneResult {
  success: boolean;
  repoPath?: string;
  commitHash?: string;
  branch?: string;
  error?: string;
  durationMs?: number;
}

/**
 * Repository cleanup result
 * Returned by cleanup functions
 */
export interface CleanupResult {
  success: boolean;
  error?: string;
  deletedPath?: string;
  durationMs?: number;
}

/**
 * Code snippet extraction options
 */
export interface SnippetExtractionOptions {
  contextLines?: number; // Number of lines before/after target line (default: 2)
  maxFileSize?: number; // Maximum file size in bytes (default: 10MB)
}
