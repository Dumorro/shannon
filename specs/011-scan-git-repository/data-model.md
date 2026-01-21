# Data Model: Git Repository Tracking for Scans

**Feature**: 011-scan-git-repository
**Created**: 2026-01-21
**Status**: Draft

## Overview

This document defines the database schema extensions required to support git repository tracking for security scans. The implementation extends existing models (Scan, Project) and introduces a new RepositoryCredentials model for secure credential storage.

**Key Design Principles**:
- **Backward Compatibility**: All repository fields are nullable to support existing scans without migration
- **Security-First**: Credentials encrypted using existing AES-256-GCM infrastructure
- **Multi-Tenant Isolation**: Per-repository-URL credential scoping within organizations
- **Simplicity**: Reuse existing schema patterns (JSON fields for evidence, existing encryption functions)

---

## 1. Scan Model Extensions

### Overview
Extends the existing `Scan` model to track repository metadata for each scan. All fields are optional to maintain backward compatibility with scans that don't include repository information.

### Schema Definition

```prisma
// Existing Scan model with repository field extensions
model Scan {
  // ... existing fields ...

  // Git Repository Tracking (Epic 011)
  repositoryUrl        String? // Git repository URL (HTTPS or SSH format)
  repositoryBranch     String? // Branch name that was scanned
  repositoryCommitHash String? // Exact commit SHA-1 hash (40 chars)

  // ... rest of existing fields ...

  @@index([repositoryUrl])
  @@index([organizationId, repositoryUrl])
}
```

### Field Specifications

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `repositoryUrl` | String | Yes | Git repository URL (HTTPS or SSH format). Normalized without `.git` suffix or trailing slash. Example: `https://github.com/acme/web-app` |
| `repositoryBranch` | String | Yes | Branch name that was scanned. Example: `main`, `develop`, `feature/auth-fix` |
| `repositoryCommitHash` | String | Yes | Full SHA-1 commit hash (40 hex characters). Automatically resolved from branch HEAD if not provided. Example: `a1b2c3d4e5f6789012345678901234567890abcd` |

### Validation Rules

```typescript
// Repository URL validation
const REPO_URL_REGEX = /^(https:\/\/|git@)[\w\.\-]+(\/|:)[\w\.\-\/]+$/;

function validateRepositoryUrl(url: string): boolean {
  return REPO_URL_REGEX.test(url);
}

// Commit hash validation
const COMMIT_HASH_REGEX = /^[a-f0-9]{40}$/;

function validateCommitHash(hash: string): boolean {
  return COMMIT_HASH_REGEX.test(hash);
}

// Branch name validation (basic)
function validateBranchName(branch: string): boolean {
  return branch.length > 0 && branch.length <= 255;
}
```

### Indexes

Two indexes are added for efficient querying:

1. **`@@index([repositoryUrl])`**: Enables filtering all scans by repository URL across projects
2. **`@@index([organizationId, repositoryUrl])`**: Composite index for organization-scoped repository queries

**Query Examples**:
```typescript
// Get all scans for a specific repository
const scans = await prisma.scan.findMany({
  where: {
    organizationId: 'org-123',
    repositoryUrl: 'https://github.com/acme/web-app'
  },
  orderBy: { createdAt: 'desc' }
});

// Get all scans for a specific branch
const branchScans = await prisma.scan.findMany({
  where: {
    organizationId: 'org-123',
    repositoryUrl: 'https://github.com/acme/web-app',
    repositoryBranch: 'main'
  }
});
```

### Example Data

```json
{
  "id": "scan_abc123",
  "organizationId": "org_xyz789",
  "projectId": "proj_def456",
  "status": "COMPLETED",
  "repositoryUrl": "https://github.com/acme/web-app",
  "repositoryBranch": "main",
  "repositoryCommitHash": "a1b2c3d4e5f6789012345678901234567890abcd",
  "createdAt": "2026-01-21T10:30:00Z",
  "findingsCount": 5
}
```

### Constraints

- **URL Normalization**: Repository URLs are normalized to remove `.git` suffix and trailing slashes before storage
- **Commit Hash Immutability**: Once set, commit hashes should not be modified
- **Branch Resolution**: If only branch is provided, system automatically resolves and stores the commit hash at scan start time

---

## 2. RepositoryCredentials Model

### Overview
New model for storing encrypted git repository credentials (Personal Access Tokens for HTTPS, SSH keys for SSH). Credentials are scoped per-repository-URL within an organization to enable credential reuse across projects accessing the same repository.

### Schema Definition

```prisma
// Credential type enum
enum CredentialType {
  PAT // Personal Access Token (HTTPS repositories)
  SSH // SSH private key (SSH repositories)
}

// RepositoryCredentials - Secure storage for git authentication
model RepositoryCredentials {
  id             String         @id @default(cuid())
  organizationId String
  repositoryUrl  String         // Normalized repository URL (without .git suffix)
  credentialType CredentialType

  // Encrypted credentials (AES-256-GCM with org-derived key)
  encryptedCredential String // Encrypted PAT token or SSH private key

  // Metadata
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdBy String   // User ID who created the credential

  // Validation tracking
  lastValidatedAt  DateTime?
  validationStatus String? // 'valid', 'invalid', 'untested'

  // Relations
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Constraints
  @@unique([organizationId, repositoryUrl])
  @@index([organizationId])
  @@index([repositoryUrl])
}
```

### Field Specifications

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | String | No | Unique identifier (CUID format) |
| `organizationId` | String | No | Foreign key to Organization. Enforces tenant isolation. |
| `repositoryUrl` | String | No | Normalized repository URL. Part of unique constraint. |
| `credentialType` | CredentialType | No | Type of credential: `PAT` (Personal Access Token) or `SSH` (SSH private key) |
| `encryptedCredential` | String | No | Encrypted credential using AES-256-GCM. Format: `iv:authTag:ciphertext` (base64) |
| `createdAt` | DateTime | No | Timestamp when credential was created |
| `updatedAt` | DateTime | No | Timestamp of last update (auto-updated by Prisma) |
| `createdBy` | String | No | User ID who created the credential |
| `lastValidatedAt` | DateTime | Yes | Timestamp of last successful validation via `git ls-remote` |
| `validationStatus` | String | Yes | Validation status: `valid`, `invalid`, or `untested` |

### Unique Constraint

**`@@unique([organizationId, repositoryUrl])`**: Enforces one credential per repository URL per organization.

**Rationale**: Multiple projects within the same organization can use the same repository URL and will automatically share the credential. This reduces credential duplication and simplifies rotation.

**Example Scenario**:
```typescript
// Organization "Acme Corp" has:
// - Project A: Web App (repo: github.com/acme/web-app)
// - Project B: API Gateway (repo: github.com/acme/api)
// - Project C: Mobile App (also uses github.com/acme/web-app)

// Only TWO credential records needed:
// 1. organizationId=acme + repositoryUrl=github.com/acme/web-app → shared by Projects A & C
// 2. organizationId=acme + repositoryUrl=github.com/acme/api → used by Project B
```

### Encryption Implementation

Credentials are encrypted using the existing encryption infrastructure from `ghostshell/lib/encryption.ts`:

```typescript
import { encryptCredential, decryptCredential } from '@/lib/encryption';

// Storing a PAT token
const encryptedToken = encryptCredential(
  personalAccessToken,
  organizationId // Used to derive encryption key
);

await prisma.repositoryCredentials.create({
  data: {
    organizationId,
    repositoryUrl: normalizeRepoUrl(repoUrl),
    credentialType: 'PAT',
    encryptedCredential: encryptedToken,
    createdBy: userId,
    validationStatus: 'untested'
  }
});

// Retrieving and decrypting credentials
const credential = await prisma.repositoryCredentials.findUnique({
  where: {
    organizationId_repositoryUrl: {
      organizationId: scan.organizationId,
      repositoryUrl: normalizeRepoUrl(scan.repositoryUrl!)
    }
  }
});

if (credential) {
  const decryptedToken = decryptCredential(
    credential.encryptedCredential,
    scan.organizationId
  );

  // Use decryptedToken for git authentication
}
```

**Encryption Details**:
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Derivation**: HMAC-SHA256 from `ENCRYPTION_MASTER_KEY` + organization ID
- **Format**: `iv:authTag:ciphertext` (all base64 encoded)
- **Master Key**: 32-byte hex string from environment variable `ENCRYPTION_MASTER_KEY`

### Credential Types

#### Personal Access Token (PAT)

Used for HTTPS repository URLs.

**Storage Example**:
```json
{
  "id": "cred_abc123",
  "organizationId": "org_xyz789",
  "repositoryUrl": "https://github.com/acme/web-app",
  "credentialType": "PAT",
  "encryptedCredential": "aGVsbG86d29ybGQ6ZGVhZGJlZWY=",
  "createdBy": "user_def456",
  "validationStatus": "valid",
  "lastValidatedAt": "2026-01-21T10:00:00Z",
  "createdAt": "2026-01-20T15:30:00Z",
  "updatedAt": "2026-01-21T10:00:00Z"
}
```

**Usage**:
```typescript
// Inject PAT into HTTPS URL
const authenticatedUrl = repoUrl.replace(
  'https://',
  `https://x-access-token:${decryptedToken}@`
);

await git.clone(authenticatedUrl, targetDir);
```

**Supported Platforms**:
- GitHub: `ghp_...` (classic) or `github_pat_...` (fine-grained)
- GitLab: `glpat-...`
- Bitbucket: App passwords

#### SSH Private Key

Used for SSH repository URLs (e.g., `git@github.com:owner/repo`).

**Storage Example**:
```json
{
  "id": "cred_xyz789",
  "organizationId": "org_xyz789",
  "repositoryUrl": "git@github.com:acme/web-app",
  "credentialType": "SSH",
  "encryptedCredential": "LS0tLS1CRUdJTiBPUEVOU1NIIFBSSVZBVEU...",
  "createdBy": "user_def456",
  "validationStatus": "valid",
  "lastValidatedAt": "2026-01-21T09:45:00Z",
  "createdAt": "2026-01-20T14:00:00Z",
  "updatedAt": "2026-01-21T09:45:00Z"
}
```

**Usage**:
```typescript
// Write SSH key to temporary file with strict permissions
const keyPath = path.join(os.tmpdir(), `ssh-key-${scanId}`);
await fs.writeFile(keyPath, decryptedKey, { mode: 0o600 });

// Configure git to use SSH key
const git = simpleGit({
  config: [`core.sshCommand=ssh -i ${keyPath} -o StrictHostKeyChecking=no`]
});

try {
  await git.clone(repoUrl, targetDir);
} finally {
  // Always cleanup key file
  await fs.unlink(keyPath);
}
```

### Validation Workflow

Before storing credentials, the system validates them by attempting to access the repository:

```typescript
// Validation endpoint: POST /api/repository-credentials/validate
async function validateCredentials(
  repoUrl: string,
  credentialType: CredentialType,
  credential: string,
  organizationId: string
): Promise<{ valid: boolean; error?: string; branches?: string[] }> {
  try {
    // Attempt git ls-remote with credentials
    const result = await gitLsRemote(repoUrl, credentialType, credential);

    return {
      valid: true,
      branches: result.branches
    };
  } catch (error) {
    return {
      valid: false,
      error: categorizeGitError(error) // 'AUTH_FAILED', 'NOT_FOUND', 'NETWORK_ERROR'
    };
  }
}
```

After validation, credentials are encrypted and stored with `validationStatus: 'valid'`.

### Security Considerations

1. **Never Log Credentials**: Credentials must be redacted from all logs and error messages
2. **Temporary SSH Keys**: SSH keys written to disk must use `0600` permissions and be deleted immediately after use
3. **URL Sanitization**: Remove credentials from URLs before logging (e.g., don't log `https://token@github.com/repo`)
4. **Audit Trail**: All credential operations (create, update, delete) are logged to `AuditLog` table
5. **Rate Limiting**: Validation endpoint must be rate-limited to prevent credential enumeration attacks

---

## 3. Project Model Extensions

### Overview
Extends the existing `Project` model to support default repository settings. When a project has default repository URL and branch configured, new scans automatically inherit these values unless explicitly overridden.

### Schema Definition

```prisma
// Existing Project model with default repository extensions
model Project {
  // ... existing fields ...

  // Git Repository Defaults (Epic 011)
  defaultRepositoryUrl    String? // Default repository URL for scans
  defaultRepositoryBranch String? // Default branch to scan (e.g., 'main', 'develop')

  // ... rest of existing fields ...
}
```

### Field Specifications

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `defaultRepositoryUrl` | String | Yes | Default repository URL used for new scans when no scan-specific URL is provided |
| `defaultRepositoryBranch` | String | Yes | Default branch to scan. If not set, system uses repository's default branch (usually `main`) |

### Behavior

When creating a new scan:

```typescript
// Scan creation with automatic defaults
async function createScan(
  projectId: string,
  options: {
    repositoryUrl?: string;
    repositoryBranch?: string;
  }
): Promise<Scan> {
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  // Use scan-specific values if provided, otherwise fall back to project defaults
  const repositoryUrl = options.repositoryUrl ?? project.defaultRepositoryUrl;
  const repositoryBranch = options.repositoryBranch ?? project.defaultRepositoryBranch;

  return prisma.scan.create({
    data: {
      projectId,
      repositoryUrl,
      repositoryBranch,
      // ... other fields
    }
  });
}
```

### Example Data

```json
{
  "id": "proj_abc123",
  "organizationId": "org_xyz789",
  "name": "Production Web App",
  "targetUrl": "https://app.example.com",
  "defaultRepositoryUrl": "https://github.com/acme/web-app",
  "defaultRepositoryBranch": "main",
  "createdAt": "2026-01-15T08:00:00Z"
}
```

### Validation Rules

- **URL Format**: Must match repository URL validation regex if provided
- **Branch Format**: Basic alphanumeric and special characters (`-`, `_`, `/`) allowed
- **Consistency**: If `defaultRepositoryUrl` is set, credentials for that URL should exist in `RepositoryCredentials`

---

## 4. Finding.evidence Schema Extension

### Overview
The existing `Finding.evidence` field (JSON type) is extended to include code snippet information when repository data is available. This schema is not enforced at the database level but is documented as a TypeScript interface for consistency.

### JSON Schema Structure

```typescript
interface FindingEvidence {
  // Existing fields (description, reproduction steps, etc.)
  description?: string;
  reproductionSteps?: string[];
  affectedUrls?: string[];
  requestResponse?: {
    request: string;
    response: string;
  };

  // NEW: Code location with snippet (Epic 011)
  codeLocation?: {
    filePath: string;         // Relative path from repository root
    lineNumber: number;       // Line number where issue occurs (1-indexed)
    codeSnippet: string;      // 5 lines of code with context (multi-line string)
    startLine: number;        // First line number in snippet
    endLine: number;          // Last line number in snippet
    repositoryUrl: string;    // Repository URL (for traceability)
    commitHash: string;       // Exact commit hash (for reproducibility)
    branch?: string;          // Branch name (optional)
  };
}
```

### Field Specifications

| Field | Type | Description |
|-------|------|-------------|
| `filePath` | string | Relative path from repository root. Example: `src/controllers/auth.ts` |
| `lineNumber` | number | Line number where vulnerability occurs (1-indexed). Example: `42` |
| `codeSnippet` | string | Multi-line string containing 5 lines of code (2 before, target line, 2 after). Includes original indentation. |
| `startLine` | number | First line number in the snippet. Example: `40` |
| `endLine` | number | Last line number in the snippet. Example: `44` |
| `repositoryUrl` | string | Repository URL from Scan record. Example: `https://github.com/acme/web-app` |
| `commitHash` | string | Full SHA-1 commit hash from Scan record. Example: `a1b2c3d4e5f6789012345678901234567890abcd` |
| `branch` | string (optional) | Branch name from Scan record. Example: `main` |

### Example Data

```json
{
  "description": "SQL injection vulnerability in user authentication",
  "reproductionSteps": [
    "Navigate to /login",
    "Enter username: admin' OR '1'='1",
    "Observe authentication bypass"
  ],
  "codeLocation": {
    "filePath": "src/controllers/auth.ts",
    "lineNumber": 42,
    "codeSnippet": "function login(req: Request, res: Response) {\n  const { username, password } = req.body;\n  const query = `SELECT * FROM users WHERE username='${username}' AND password='${password}'`; // VULNERABLE\n  const user = db.query(query);\n  if (user) return res.json({ token: generateToken(user.id) });\n}",
    "startLine": 40,
    "endLine": 45,
    "repositoryUrl": "https://github.com/acme/web-app",
    "commitHash": "a1b2c3d4e5f6789012345678901234567890abcd",
    "branch": "main"
  }
}
```

### Code Snippet Extraction

Snippets are extracted during finding generation using the following algorithm:

```typescript
async function extractCodeSnippet(
  repoPath: string,
  filePath: string,
  lineNumber: number,
  contextLines: number = 2
): Promise<CodeLocation | null> {
  const fullPath = path.join(repoPath, filePath);

  // Check file exists and is not binary
  if (!await fs.pathExists(fullPath)) return null;
  if (await isBinaryFile(fullPath)) return null;

  // Read file as UTF-8
  const content = await fs.readFile(fullPath, 'utf-8');
  const lines = content.split('\n');

  // Calculate range (convert 1-indexed to 0-indexed)
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
    repositoryUrl: scan.repositoryUrl!,
    commitHash: scan.repositoryCommitHash!,
    branch: scan.repositoryBranch ?? undefined
  };
}
```

### Edge Cases

1. **Binary Files**: Skip snippet extraction for binary files (images, compiled binaries, etc.)
2. **Large Files**: For files >10MB, skip snippet extraction to avoid memory issues
3. **Missing Lines**: If line number exceeds file length, return last 5 lines of file with warning note
4. **UTF-8 Errors**: If file cannot be read as UTF-8, skip snippet extraction
5. **No Repository**: If scan has no repository information, `codeLocation` is omitted entirely

---

## 5. Migration Strategy

### Overview
All schema changes are designed to be backward compatible with existing data. No data migration is required for existing records.

### Migration SQL

```sql
-- Migration: Add repository tracking fields to Scan model
-- File: ghostshell/prisma/migrations/YYYYMMDDHHMMSS_add_repository_tracking/migration.sql

BEGIN;

-- Step 1: Add nullable repository fields to Scan table
ALTER TABLE "Scan"
  ADD COLUMN "repositoryUrl" TEXT,
  ADD COLUMN "repositoryBranch" TEXT,
  ADD COLUMN "repositoryCommitHash" TEXT;

-- Step 2: Add indexes for efficient querying
CREATE INDEX "Scan_repositoryUrl_idx" ON "Scan"("repositoryUrl");
CREATE INDEX "Scan_organizationId_repositoryUrl_idx" ON "Scan"("organizationId", "repositoryUrl");

-- Step 3: Add default repository fields to Project table
ALTER TABLE "Project"
  ADD COLUMN "defaultRepositoryUrl" TEXT,
  ADD COLUMN "defaultRepositoryBranch" TEXT;

-- Step 4: Create CredentialType enum
CREATE TYPE "CredentialType" AS ENUM ('PAT', 'SSH');

-- Step 5: Create RepositoryCredentials table
CREATE TABLE "RepositoryCredentials" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "repositoryUrl" TEXT NOT NULL,
  "credentialType" "CredentialType" NOT NULL,
  "encryptedCredential" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT NOT NULL,
  "lastValidatedAt" TIMESTAMP(3),
  "validationStatus" TEXT,

  CONSTRAINT "RepositoryCredentials_pkey" PRIMARY KEY ("id")
);

-- Step 6: Add foreign key constraint
ALTER TABLE "RepositoryCredentials"
  ADD CONSTRAINT "RepositoryCredentials_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Step 7: Add unique constraint (one credential per repo per org)
ALTER TABLE "RepositoryCredentials"
  ADD CONSTRAINT "RepositoryCredentials_organizationId_repositoryUrl_key"
  UNIQUE ("organizationId", "repositoryUrl");

-- Step 8: Add indexes for RepositoryCredentials
CREATE INDEX "RepositoryCredentials_organizationId_idx" ON "RepositoryCredentials"("organizationId");
CREATE INDEX "RepositoryCredentials_repositoryUrl_idx" ON "RepositoryCredentials"("repositoryUrl");

COMMIT;
```

### Backward Compatibility

**Existing Scans**:
- All repository fields are nullable (`String?`)
- Existing scans without repository data continue to function normally
- No migration script needed to populate existing data
- New scans can optionally include repository information

**Existing Projects**:
- Default repository fields are nullable
- Existing projects without defaults continue to work
- Projects can be updated to add defaults at any time

**Finding.evidence JSON**:
- Existing findings without `codeLocation` remain valid
- New findings can include `codeLocation` if repository data is available
- No schema validation at database level (flexible JSON field)

### Rollout Strategy

The feature can be rolled out incrementally:

1. **Phase 1**: Deploy database migration (non-breaking, all fields nullable)
2. **Phase 2**: Deploy credential management UI (users can add credentials)
3. **Phase 3**: Deploy scan configuration UI (users can specify repository per scan)
4. **Phase 4**: Integrate repository cloning into Shannon scan workflow
5. **Phase 5**: Enable code snippet extraction in findings generation
6. **Phase 6**: Add project defaults UI (optional convenience feature)

Each phase is independently deployable without breaking existing functionality.

### Data Cleanup

**Orphaned Credentials**: Credentials are automatically deleted when the organization is deleted (CASCADE constraint).

**Expired Validations**: Implement periodic validation refresh:

```typescript
// Background job: Re-validate credentials older than 30 days
async function refreshStaleCredentials() {
  const staleCredentials = await prisma.repositoryCredentials.findMany({
    where: {
      OR: [
        { validationStatus: 'untested' },
        {
          lastValidatedAt: {
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
          }
        }
      ]
    }
  });

  for (const credential of staleCredentials) {
    const isValid = await validateCredential(credential);

    await prisma.repositoryCredentials.update({
      where: { id: credential.id },
      data: {
        validationStatus: isValid ? 'valid' : 'invalid',
        lastValidatedAt: new Date()
      }
    });
  }
}
```

---

## 6. Relationships & Constraints Summary

### Entity Relationships

```
Organization (1) ----< (N) RepositoryCredentials
Organization (1) ----< (N) Project
Organization (1) ----< (N) Scan
Project (1) ----< (N) Scan
Scan (1) ----< (N) Finding
```

**New Relationship**:
```
Organization (1) ----< (N) RepositoryCredentials
```

### Foreign Key Constraints

| Table | Foreign Key | References | On Delete |
|-------|-------------|------------|-----------|
| RepositoryCredentials | organizationId | Organization.id | CASCADE |

**CASCADE Behavior**: When an organization is deleted, all associated repository credentials are automatically deleted. This ensures no orphaned credentials remain in the database.

### Unique Constraints

| Table | Constraint | Columns |
|-------|-----------|---------|
| RepositoryCredentials | organizationId_repositoryUrl | [organizationId, repositoryUrl] |

**Purpose**: Enforces one credential per repository URL per organization. Multiple projects can share the same credential.

### Indexes Summary

| Table | Index Name | Columns | Purpose |
|-------|-----------|---------|---------|
| Scan | repositoryUrl_idx | [repositoryUrl] | Filter scans by repository across projects |
| Scan | organizationId_repositoryUrl_idx | [organizationId, repositoryUrl] | Org-scoped repository queries |
| RepositoryCredentials | organizationId_idx | [organizationId] | Fetch all credentials for an org |
| RepositoryCredentials | repositoryUrl_idx | [repositoryUrl] | Lookup credentials by URL |

---

## 7. TypeScript Types & Interfaces

### Model Types (Auto-Generated by Prisma)

```typescript
import { Prisma } from '@prisma/client';

// Scan with repository fields
type ScanWithRepository = Prisma.ScanGetPayload<{
  select: {
    id: true;
    repositoryUrl: true;
    repositoryBranch: true;
    repositoryCommitHash: true;
  };
}>;

// RepositoryCredentials with organization
type RepositoryCredentialWithOrg = Prisma.RepositoryCredentialsGetPayload<{
  include: {
    organization: true;
  };
}>;

// Project with repository defaults
type ProjectWithDefaults = Prisma.ProjectGetPayload<{
  select: {
    id: true;
    name: true;
    defaultRepositoryUrl: true;
    defaultRepositoryBranch: true;
  };
}>;
```

### Application-Level Interfaces

```typescript
// Code location within a finding
interface CodeLocation {
  filePath: string;
  lineNumber: number;
  codeSnippet: string;
  startLine: number;
  endLine: number;
  repositoryUrl: string;
  commitHash: string;
  branch?: string;
}

// Finding evidence with code location
interface FindingEvidence {
  description?: string;
  reproductionSteps?: string[];
  affectedUrls?: string[];
  requestResponse?: {
    request: string;
    response: string;
  };
  codeLocation?: CodeLocation;
}

// Repository validation result
interface RepositoryValidationResult {
  valid: boolean;
  error?: 'AUTH_FAILED' | 'NOT_FOUND' | 'NETWORK_ERROR' | 'REPO_TOO_LARGE' | 'VALIDATION_TIMEOUT';
  estimatedSize?: number; // bytes
  defaultBranch?: string;
  branches?: string[];
  duration: number; // milliseconds
}

// Credential creation input
interface CreateCredentialInput {
  organizationId: string;
  repositoryUrl: string;
  credentialType: 'PAT' | 'SSH';
  credential: string; // Plain text (will be encrypted)
  createdBy: string;
}

// Scan creation with repository
interface CreateScanInput {
  projectId: string;
  repositoryUrl?: string; // Override project default
  repositoryBranch?: string; // Override project default
  repositoryCommitHash?: string; // Optional: scan specific commit
  // ... other scan fields
}
```

---

## 8. Performance Considerations

### Query Performance

**Expected Query Patterns**:

1. **Get all scans for a repository** (uses `organizationId_repositoryUrl_idx`):
   ```typescript
   // ~50ms for 10,000 scans
   const scans = await prisma.scan.findMany({
     where: {
       organizationId: 'org-123',
       repositoryUrl: 'https://github.com/acme/web-app'
     }
   });
   ```

2. **Get credentials for repository** (uses unique constraint index):
   ```typescript
   // ~10ms (unique lookup)
   const credential = await prisma.repositoryCredentials.findUnique({
     where: {
       organizationId_repositoryUrl: {
         organizationId: 'org-123',
         repositoryUrl: 'https://github.com/acme/web-app'
       }
     }
   });
   ```

3. **Filter scans by branch** (requires table scan if not indexed):
   ```typescript
   // ~200ms for 10,000 scans (sequential scan on repositoryBranch)
   // Consider adding index if this query is frequent
   const branchScans = await prisma.scan.findMany({
     where: {
       organizationId: 'org-123',
       repositoryUrl: 'https://github.com/acme/web-app',
       repositoryBranch: 'main'
     }
   });
   ```

**Optimization Recommendation**: If filtering by branch becomes a common query pattern, add a composite index:

```prisma
@@index([organizationId, repositoryUrl, repositoryBranch])
```

### Storage Impact

**Per Scan**:
- `repositoryUrl`: ~50-100 bytes (average URL length)
- `repositoryBranch`: ~10-30 bytes (average branch name)
- `repositoryCommitHash`: 40 bytes (fixed SHA-1 length)
- **Total**: ~100-170 bytes per scan

**Per Credential**:
- `encryptedCredential`: ~500-1,000 bytes (PAT) or ~3,000-5,000 bytes (SSH key)
- Other metadata: ~200 bytes
- **Total**: ~700-5,200 bytes per credential

**Expected Impact**:
- 10,000 scans with repository data: ~1-2 MB
- 100 repository credentials: ~70-520 KB
- **Negligible** compared to existing scan data and findings

### Code Snippet Storage

**Finding.evidence JSON**:
- Code snippets (5 lines): ~200-500 bytes per finding (depends on code line length)
- Other evidence data: ~500-2,000 bytes
- **Total**: ~700-2,500 bytes per finding with code snippet

**Expected Impact**:
- 100 findings with code snippets: ~70-250 KB per scan
- Acceptable overhead for improved developer experience (immediate code context)

---

## 9. Security & Compliance

### Data Protection

1. **Encryption at Rest**:
   - Repository credentials encrypted using AES-256-GCM
   - Encryption keys derived per organization (HMAC-SHA256)
   - Master key stored in environment variable (never in database)

2. **Encryption in Transit**:
   - All API calls use HTTPS/TLS 1.3
   - Git operations use HTTPS or SSH (both encrypted)

3. **Access Control**:
   - Credentials scoped per organization (multi-tenant isolation)
   - Only organization members can view/manage credentials
   - Role-based access control (RBAC) via OrganizationMembership

### Audit Trail

All credential operations are logged to the existing `AuditLog` table:

```typescript
// Credential creation
await prisma.auditLog.create({
  data: {
    organizationId,
    userId: createdBy,
    action: 'repository.credential.created',
    resourceType: 'RepositoryCredential',
    resourceId: credential.id,
    metadata: {
      repositoryUrl: credential.repositoryUrl,
      credentialType: credential.credentialType
    },
    ipAddress: req.ip
  }
});

// Credential deletion
await prisma.auditLog.create({
  data: {
    organizationId,
    userId: deletedBy,
    action: 'repository.credential.deleted',
    resourceType: 'RepositoryCredential',
    resourceId: credentialId,
    metadata: {
      repositoryUrl: credential.repositoryUrl
    },
    ipAddress: req.ip
  }
});
```

### Compliance Considerations

- **GDPR**: Repository URLs may contain user information. Ensure organization deletion cascades to credentials.
- **SOC 2**: Audit logs provide traceability for credential lifecycle events.
- **PCI DSS**: Encryption key management follows industry standards (separate master key, per-tenant derivation).

---

## 10. Testing Strategy

### Unit Tests

```typescript
// Test: Repository URL normalization
test('normalizes repository URLs', () => {
  expect(normalizeRepoUrl('https://github.com/acme/repo.git'))
    .toBe('https://github.com/acme/repo');

  expect(normalizeRepoUrl('https://github.com/acme/repo/'))
    .toBe('https://github.com/acme/repo');
});

// Test: Commit hash validation
test('validates commit hashes', () => {
  expect(validateCommitHash('a1b2c3d4e5f6789012345678901234567890abcd')).toBe(true);
  expect(validateCommitHash('invalid')).toBe(false);
  expect(validateCommitHash('a1b2c3d4')).toBe(false); // Too short
});

// Test: Credential encryption/decryption
test('encrypts and decrypts credentials', () => {
  const plaintext = 'ghp_myPersonalAccessToken123';
  const orgId = 'org-123';

  const encrypted = encryptCredential(plaintext, orgId);
  const decrypted = decryptCredential(encrypted, orgId);

  expect(decrypted).toBe(plaintext);
  expect(encrypted).not.toBe(plaintext);
});
```

### Integration Tests

```typescript
// Test: Unique constraint enforcement
test('prevents duplicate credentials for same org+repo', async () => {
  const orgId = 'org-123';
  const repoUrl = 'https://github.com/acme/repo';

  // Create first credential
  await prisma.repositoryCredentials.create({
    data: {
      organizationId: orgId,
      repositoryUrl: repoUrl,
      credentialType: 'PAT',
      encryptedCredential: 'encrypted...',
      createdBy: 'user-123'
    }
  });

  // Attempt to create duplicate
  await expect(
    prisma.repositoryCredentials.create({
      data: {
        organizationId: orgId,
        repositoryUrl: repoUrl,
        credentialType: 'PAT',
        encryptedCredential: 'encrypted...',
        createdBy: 'user-456'
      }
    })
  ).rejects.toThrow('Unique constraint failed');
});

// Test: Cascade deletion
test('deletes credentials when organization is deleted', async () => {
  const org = await prisma.organization.create({
    data: { name: 'Test Org', slug: 'test-org' }
  });

  const credential = await prisma.repositoryCredentials.create({
    data: {
      organizationId: org.id,
      repositoryUrl: 'https://github.com/test/repo',
      credentialType: 'PAT',
      encryptedCredential: 'encrypted...',
      createdBy: 'user-123'
    }
  });

  // Delete organization
  await prisma.organization.delete({ where: { id: org.id } });

  // Verify credential was deleted
  const deletedCredential = await prisma.repositoryCredentials.findUnique({
    where: { id: credential.id }
  });

  expect(deletedCredential).toBeNull();
});
```

### End-to-End Tests

```typescript
// Test: Scan creation with repository defaults
test('uses project defaults for scan repository', async () => {
  const project = await prisma.project.create({
    data: {
      name: 'Test Project',
      organizationId: 'org-123',
      targetUrl: 'https://example.com',
      defaultRepositoryUrl: 'https://github.com/acme/web-app',
      defaultRepositoryBranch: 'main'
    }
  });

  const scan = await createScan(project.id, {});

  expect(scan.repositoryUrl).toBe(project.defaultRepositoryUrl);
  expect(scan.repositoryBranch).toBe(project.defaultRepositoryBranch);
});

// Test: Code snippet extraction in findings
test('extracts code snippet for finding', async () => {
  const repoPath = '/tmp/test-repo';
  const filePath = 'src/auth.ts';
  const lineNumber = 10;

  const snippet = await extractCodeSnippet(repoPath, filePath, lineNumber);

  expect(snippet).toBeDefined();
  expect(snippet.filePath).toBe(filePath);
  expect(snippet.lineNumber).toBe(lineNumber);
  expect(snippet.codeSnippet.split('\n')).toHaveLength(5);
  expect(snippet.startLine).toBe(8);
  expect(snippet.endLine).toBe(12);
});
```

---

## 11. Error Handling

### Database Errors

```typescript
// Handle unique constraint violation
try {
  await prisma.repositoryCredentials.create({ data: { ... } });
} catch (error) {
  if (error.code === 'P2002') {
    throw new ConflictError(
      'Credential already exists for this repository. Please update the existing credential instead.'
    );
  }
  throw error;
}

// Handle foreign key constraint violation
try {
  await prisma.repositoryCredentials.create({
    data: { organizationId: 'invalid-org-id', ... }
  });
} catch (error) {
  if (error.code === 'P2003') {
    throw new NotFoundError('Organization not found');
  }
  throw error;
}
```

### Validation Errors

```typescript
// Repository URL validation
if (!validateRepositoryUrl(repositoryUrl)) {
  throw new ValidationError(
    'Invalid repository URL. Must be a valid HTTPS or SSH git URL. ' +
    'Examples: https://github.com/owner/repo or git@github.com:owner/repo'
  );
}

// Commit hash validation
if (commitHash && !validateCommitHash(commitHash)) {
  throw new ValidationError(
    'Invalid commit hash. Must be a 40-character hexadecimal string (SHA-1 hash).'
  );
}

// Credential type validation
if (!['PAT', 'SSH'].includes(credentialType)) {
  throw new ValidationError(
    'Invalid credential type. Must be either "PAT" (Personal Access Token) or "SSH" (SSH Private Key).'
  );
}
```

---

## Conclusion

This data model provides a robust, secure, and backward-compatible foundation for git repository tracking in Shannon's security scanning infrastructure. The design prioritizes:

1. **Security**: AES-256-GCM encryption, multi-tenant isolation, audit logging
2. **Simplicity**: Reuse existing patterns (encryption, JSON evidence, nullable fields)
3. **Flexibility**: Support for HTTPS/SSH, per-scan overrides, project defaults
4. **Performance**: Strategic indexes, efficient queries, minimal storage overhead
5. **Maintainability**: Clear schema, comprehensive documentation, extensive testing

All requirements from the feature specification are addressed, and the migration strategy ensures zero downtime during deployment.

---

**Next Steps**: Proceed to API contract definition in `contracts/openapi.yaml` to define REST endpoints for credential management and repository validation.
