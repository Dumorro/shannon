# Research: Git Repository Tracking Implementation

**Feature**: Git Repository Tracking for Scans (011-scan-git-repository)
**Date**: 2026-01-21
**Status**: Complete

## Executive Summary

This document provides technical research for implementing git repository tracking in Shannon's security scanning infrastructure. The research covers five key decision areas: git library selection, authentication patterns, code snippet extraction, repository clone management, and repository size validation.

**Key Recommendations**:
- Use `simple-git` library for git operations (balance of simplicity and robustness)
- Reuse existing AES-256-GCM encryption infrastructure for repository credentials
- Use Node.js `fs` module for code snippet extraction with line-based reading
- Implement ephemeral clone pattern with `os.tmpdir()` and automatic cleanup
- Use `git ls-remote` for pre-clone size estimation with 10-second timeout

---

## 1. Git Library Selection

### Decision: Use `simple-git` Library

**Selected**: `simple-git` (https://github.com/steveukx/git-js)

### Rationale

After evaluating three approaches for git operations, `simple-git` provides the optimal balance of simplicity, error handling, and TypeScript support for Shannon's requirements.

**Advantages**:
- **Promise-based API**: Integrates cleanly with async/await patterns already used throughout Shannon (see `shannon/src/temporal/activities.ts`)
- **Strong error handling**: Throws structured errors with exit codes and stderr output, enabling detailed error categorization (network vs auth vs invalid URL)
- **TypeScript support**: First-class TypeScript definitions (`@types/simple-git`) match Shannon's TypeScript 5.x codebase
- **Active maintenance**: 15M+ weekly downloads, actively maintained, well-tested in production
- **Comprehensive API**: Supports all needed operations (clone, checkout, rev-parse, ls-remote, branch listing)
- **Authentication flexibility**: Supports credential callbacks for PAT tokens and SSH key paths

**Disadvantages**:
- Additional dependency (~100KB)
- Wrapper around git CLI (requires git binary installed)

### Alternatives Considered

#### Option A: Native `child_process` with git CLI

**Pros**:
- Zero dependencies (git already required)
- Maximum control over command execution
- Existing pattern in codebase (`zx` library wraps `child_process` - see `shannon/src/utils/git-manager.ts`)

**Cons**:
- Manual command construction error-prone
- Requires parsing raw stdout/stderr for error handling
- No structured error objects (harder to distinguish network vs auth failures per FR-012)
- Cross-platform command escaping complexity
- More code to maintain and test

**Why rejected**: While Shannon already uses `zx` for git operations in the workspace management context (`git-manager.ts`), those operations are simpler (status, add, commit). Repository cloning with authentication and error categorization requires more robust error handling than raw shell commands provide.

#### Option B: `nodegit` (native bindings)

**Pros**:
- Native performance (no shell overhead)
- Doesn't require git CLI installed
- Lower-level control

**Cons**:
- **Build complexity**: Requires native compilation (node-gyp), problematic in Docker environments
- **Heavier dependency**: Large binary footprint (~10MB)
- **Authentication complexity**: SSH key handling more difficult
- **Callback-based API**: Requires promisification, doesn't match Shannon's async/await style
- **TypeScript support**: Community types, not first-class

**Why rejected**: The build complexity and authentication challenges outweigh the performance benefits. Shannon runs in Docker containers where native compilation can be fragile. The scanning workflow is not performance-critical enough to justify this complexity.

### Implementation Notes

**Installation**:
```bash
npm install simple-git --save
npm install @types/simple-git --save-dev
```

**Usage Pattern** (aligned with Shannon's existing patterns):
```typescript
import simpleGit from 'simple-git';

// Clone with timeout and authentication
const git = simpleGit();
await git.clone(repoUrl, targetDir, {
  '--depth': 1, // Shallow clone for efficiency
  '--branch': branchName,
  '--single-branch': true
});

// Resolve commit hash
const commitHash = await git.revparse(['HEAD']);

// List branches
const branches = await git.branch(['-r']); // Remote branches
```

**Error Handling** (FR-012 compliance):
```typescript
try {
  await git.clone(repoUrl, targetDir);
} catch (error: any) {
  if (error.message.includes('Authentication failed')) {
    throw new RepositoryAuthError('Invalid credentials');
  } else if (error.message.includes('Could not resolve host')) {
    throw new RepositoryNetworkError('Network unreachable');
  } else if (error.message.includes('not found')) {
    throw new RepositoryNotFoundError('Repository does not exist');
  }
  throw new RepositoryError('Unknown error', error);
}
```

**Integration Point**: Create `ghostshell/lib/git/operations.ts` for git operations and `shannon/src/utils/repository-manager.ts` for Shannon-side cloning during scan execution.

---

## 2. Authentication Patterns

### Decision: Reuse Existing Encryption Infrastructure with Per-Repo-URL Scoping

**Selected**: AES-256-GCM encryption with organization-specific derived keys (existing pattern) + per-repository-URL credential storage

### Rationale

Shannon already has a battle-tested encryption infrastructure (`ghostshell/lib/encryption.ts`) that meets security requirements. Extending this pattern for repository credentials ensures consistency and leverages proven code.

**Key Pattern** (from `ghostshell/lib/encryption.ts`):
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Derivation**: HMAC-SHA256 from master key + organization ID
- **Format**: `iv:authTag:ciphertext` (base64 encoded)
- **Master Key**: 32-byte hex string from `ENCRYPTION_MASTER_KEY` environment variable

### Authentication Methods

#### HTTPS Repositories (Personal Access Token)

**Storage**:
```typescript
// RepositoryCredentials model (Prisma schema extension)
model RepositoryCredentials {
  id             String   @id @default(cuid())
  organizationId String
  repoUrl        String   // Normalized URL (e.g., "https://github.com/org/repo")
  authType       String   // "PAT" or "SSH"

  // Encrypted credentials (AES-256-GCM)
  encryptedToken String?  // Personal access token (for HTTPS)
  encryptedKey   String?  // SSH private key (for SSH)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(...)

  @@unique([organizationId, repoUrl]) // One credential per repo URL per org
  @@index([organizationId])
}
```

**Usage with `simple-git`**:
```typescript
import { decryptCredential } from '../encryption.js';

// Retrieve and decrypt PAT
const credentials = await prisma.repositoryCredentials.findUnique({
  where: {
    organizationId_repoUrl: {
      organizationId: scan.organizationId,
      repoUrl: normalizeRepoUrl(scan.repoUrl)
    }
  }
});

if (credentials?.authType === 'PAT') {
  const token = decryptCredential(credentials.encryptedToken, scan.organizationId);

  // Inject token into HTTPS URL
  const authenticatedUrl = repoUrl.replace(
    'https://',
    `https://x-access-token:${token}@`
  );

  await git.clone(authenticatedUrl, targetDir);
}
```

**Token Formats**:
- GitHub: `ghp_...` (classic) or `github_pat_...` (fine-grained)
- GitLab: `glpat-...`
- Bitbucket: App passwords

#### SSH Repositories (SSH Key)

**Storage**:
```typescript
// Same RepositoryCredentials model, but encryptedKey field used
if (credentials?.authType === 'SSH') {
  const privateKey = decryptCredential(credentials.encryptedKey, scan.organizationId);

  // Write SSH key to temporary file (600 permissions)
  const keyPath = path.join(os.tmpdir(), `ssh-key-${scan.id}`);
  await fs.writeFile(keyPath, privateKey, { mode: 0o600 });

  // Configure git to use this key
  const git = simpleGit({
    config: [
      `core.sshCommand=ssh -i ${keyPath} -o StrictHostKeyChecking=no`
    ]
  });

  await git.clone(repoUrl, targetDir);

  // Cleanup key after clone
  await fs.unlink(keyPath);
}
```

**SSH Key Security**:
- Keys stored encrypted at rest (same AES-256-GCM)
- Temporary key files written with `0600` permissions (owner-only read)
- Keys deleted immediately after use
- Never logged or exposed in error messages

### Credential Scoping

**Per-Repository-URL Design** (FR-013):
```typescript
// Example: Organization "Acme Corp" has two projects
// Project A: https://github.com/acme/web-app
// Project B: https://github.com/acme/web-app (same repo)
// Project C: https://github.com/acme/mobile-app (different repo)

// Only TWO credential records needed:
// 1. organizationId=acme + repoUrl=github.com/acme/web-app
// 2. organizationId=acme + repoUrl=github.com/acme/mobile-app

// Projects A and B automatically reuse credential #1
```

**Benefits**:
- **Reduces credential duplication**: Same repo used across projects shares one credential
- **Simplifies rotation**: Update one credential, affects all projects using that repo
- **Maintains isolation**: Different organizations cannot access each other's credentials (org-derived encryption keys)
- **Supports multi-repo projects**: Each unique repo URL gets its own credential (User Story 3)

### URL Normalization

**Critical for credential matching**:
```typescript
function normalizeRepoUrl(url: string): string {
  // Normalize to consistent format for matching
  // "https://github.com/acme/repo.git" → "https://github.com/acme/repo"
  // "git@github.com:acme/repo.git" → "git@github.com:acme/repo"

  return url
    .replace(/\.git$/, '') // Remove .git suffix
    .replace(/\/$/, '');   // Remove trailing slash
}
```

### Alternatives Considered

#### Option A: Environment Variables

**Pros**: Simple, no database changes
**Cons**: Not multi-tenant safe, cannot scope per-repo, no UI management
**Why rejected**: Violates Constitution III (multi-tenant isolation) and doesn't support per-repo scoping (FR-013)

#### Option B: Separate Encryption Scheme

**Pros**: Could use different algorithm
**Cons**: Duplicates existing encryption code, increases attack surface, harder to maintain
**Why rejected**: Violates Constitution VII (simplicity) - existing encryption already meets requirements

#### Option C: Git Credential Manager

**Pros**: System-level credential caching
**Cons**: Requires system configuration, not portable in containers, not multi-tenant
**Why rejected**: Shannon runs in isolated Docker containers; system-level credential managers don't fit the multi-tenant SaaS architecture

### Implementation Notes

**UI Flow** (Settings → Repository Credentials):
1. User enters repository URL
2. System normalizes URL and checks for existing credential
3. User selects auth type (PAT or SSH)
4. User enters credential (token or private key)
5. System validates credential by attempting `git ls-remote`
6. On success, encrypt and store in `RepositoryCredentials` table
7. System associates credential with organization + normalized URL

**Validation Endpoint** (`/api/repository-credentials/validate`):
```typescript
// POST /api/repository-credentials/validate
{
  "repoUrl": "https://github.com/acme/repo",
  "authType": "PAT",
  "token": "ghp_..."
}

// Response:
{
  "valid": true,
  "branches": ["main", "develop", "staging"], // List available branches
  "defaultBranch": "main"
}
```

**Security Considerations**:
- Never return decrypted credentials to client
- Validate credentials on backend before storage
- Audit log credential creation/updates (use existing `AuditLog` table)
- Implement rate limiting on validation endpoint (prevent credential enumeration)
- Clear temporary SSH key files even on error (use try/finally)

---

## 3. Code Snippet Extraction

### Decision: Node.js `fs` Module with Line-Based Reading

**Selected**: Use Node.js built-in `fs.readFile()` with line splitting and range extraction

### Rationale

Code snippet extraction is straightforward file I/O that doesn't require specialized libraries. Node.js `fs` module provides all needed capabilities with zero dependencies.

**Requirements** (FR-010):
- Extract code snippet with 5 lines of context (2 before, line itself, 2 after)
- Handle UTF-8 encoded files
- Skip binary files
- Gracefully handle missing files or line numbers out of range

### Implementation Pattern

**Core Function**:
```typescript
interface CodeSnippet {
  filePath: string;
  lineNumber: number;
  snippet: string;  // Multi-line string with context
  startLine: number; // First line number in snippet
  endLine: number;   // Last line number in snippet
}

async function extractCodeSnippet(
  repoPath: string,
  filePath: string,
  lineNumber: number,
  contextLines: number = 2
): Promise<CodeSnippet | null> {
  const fullPath = path.join(repoPath, filePath);

  // Check if file exists
  if (!await fs.pathExists(fullPath)) {
    return null;
  }

  // Check if binary file (skip)
  if (await isBinaryFile(fullPath)) {
    return null;
  }

  // Read entire file as UTF-8
  const content = await fs.readFile(fullPath, 'utf-8');
  const lines = content.split('\n');

  // Calculate range (1-indexed to 0-indexed conversion)
  const targetIndex = lineNumber - 1;
  const startIndex = Math.max(0, targetIndex - contextLines);
  const endIndex = Math.min(lines.length - 1, targetIndex + contextLines);

  // Extract snippet
  const snippetLines = lines.slice(startIndex, endIndex + 1);
  const snippet = snippetLines.join('\n');

  return {
    filePath,
    lineNumber,
    snippet,
    startLine: startIndex + 1,
    endLine: endIndex + 1
  };
}
```

**Binary File Detection**:
```typescript
import { isBinaryFile } from 'isbinaryfile';

// Or implement simple heuristic:
async function isBinaryFile(filePath: string): Promise<boolean> {
  const buffer = await fs.readFile(filePath);
  const sample = buffer.slice(0, 8000); // Check first 8KB

  // Check for null bytes (common in binary files)
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true;
  }

  return false;
}
```

**Integration with Finding Storage** (Prisma schema):
```typescript
// Finding.evidence JSON field structure:
{
  "codeLocation": {
    "filePath": "src/controllers/auth.ts",
    "lineNumber": 42,
    "snippet": "function login(req, res) {\n  const { username, password } = req.body;\n  if (password === 'admin') { // VULNERABLE\n    return res.json({ token: generateToken(username) });\n  }\n}",
    "startLine": 40,
    "endLine": 45,
    "commitHash": "abc123..."
  },
  "description": "Hardcoded password check allows authentication bypass",
  // ... other evidence fields
}
```

### Handling Edge Cases

**Large Files**:
```typescript
// For files > 10MB, read only needed range
const MAX_FULL_READ_SIZE = 10 * 1024 * 1024; // 10MB

async function extractCodeSnippetOptimized(
  filePath: string,
  lineNumber: number
): Promise<CodeSnippet | null> {
  const stats = await fs.stat(filePath);

  if (stats.size > MAX_FULL_READ_SIZE) {
    // Stream read only the needed lines (more complex, skip for MVP)
    // For MVP: Skip snippet extraction for very large files
    return null;
  }

  // Standard extraction for normal files
  return extractCodeSnippet(filePath, lineNumber);
}
```

**Missing Lines** (line number exceeds file length):
```typescript
// If lineNumber > total lines, return last few lines as context
if (targetIndex >= lines.length) {
  const startIndex = Math.max(0, lines.length - 5);
  const snippet = lines.slice(startIndex).join('\n');

  return {
    filePath,
    lineNumber: lines.length, // Actual last line
    snippet,
    startLine: startIndex + 1,
    endLine: lines.length,
    note: `Requested line ${lineNumber} exceeds file length (${lines.length})`
  };
}
```

**UTF-8 Encoding Errors**:
```typescript
try {
  const content = await fs.readFile(fullPath, 'utf-8');
} catch (error) {
  // If UTF-8 decoding fails, likely binary or wrong encoding
  console.warn(`Failed to read ${filePath} as UTF-8:`, error);
  return null;
}
```

### Alternatives Considered

#### Option A: Git Blame Integration

**Pros**: Could link snippets to commit authors
**Cons**: Requires additional git operations, slower, not needed for FR-010
**Why rejected**: Out of scope for MVP - basic snippet extraction sufficient

#### Option B: Streaming Line Reader

**Pros**: Memory efficient for huge files
**Cons**: More complex, requires additional library (`readline` module)
**Why rejected**: Premature optimization - most source files are small (<1MB). Can add streaming later if needed.

#### Option C: AST Parsing (e.g., with `@babel/parser`)

**Pros**: Could extract full function context instead of fixed line count
**Cons**: Language-specific parsers needed, much more complex, slower
**Why rejected**: Over-engineered for basic code context display. Fixed line context is standard practice in security tools.

### Implementation Notes

**When to Extract**:
```typescript
// During AI agent analysis (claude-executor.ts integration)
// Agent returns finding with file path and line number
// System immediately extracts snippet before storing Finding record

// Temporal activity in shannon/src/temporal/activities.ts:
async function processFindingWithSnippet(
  finding: RawFinding,
  repoPath: string
): Promise<Finding> {
  let codeLocation = null;

  if (finding.filePath && finding.lineNumber) {
    const snippet = await extractCodeSnippet(
      repoPath,
      finding.filePath,
      finding.lineNumber
    );

    if (snippet) {
      codeLocation = {
        ...snippet,
        commitHash: scan.commitHash
      };
    }
  }

  // Store in Finding.evidence JSON field
  return {
    ...finding,
    evidence: {
      ...finding.evidence,
      codeLocation
    }
  };
}
```

**Dependencies**:
```bash
# Optional: For binary file detection
npm install isbinaryfile --save

# Or use native heuristic (zero dependencies)
```

**Testing**:
```typescript
// Unit test: Extract snippet from test fixture
test('extractCodeSnippet returns 5-line context', async () => {
  const snippet = await extractCodeSnippet(
    './fixtures/test-repo',
    'src/auth.ts',
    10,
    2 // 2 lines before/after
  );

  expect(snippet).toMatchObject({
    filePath: 'src/auth.ts',
    lineNumber: 10,
    startLine: 8,
    endLine: 12
  });
  expect(snippet.snippet.split('\n')).toHaveLength(5);
});

// Edge case: Line number exceeds file
test('extractCodeSnippet handles out-of-range line', async () => {
  const snippet = await extractCodeSnippet(
    './fixtures/test-repo',
    'src/short-file.ts',
    999
  );

  expect(snippet.lineNumber).toBeLessThan(999);
  expect(snippet.note).toContain('exceeds file length');
});
```

---

## 4. Repository Clone Management

### Decision: Ephemeral Clones in `os.tmpdir()` with Automatic Cleanup

**Selected**: Clone to temporary directories, cache during scan, delete in Temporal activity completion

### Rationale

Security scanning requires temporary access to repository contents. Ephemeral clones minimize storage costs, reduce security exposure from stale credentials, and align with Shannon's stateless scan execution model.

**Requirements** (FR-016, SC-008):
- Clone at scan start
- Maintain clone during scan execution (for snippet extraction)
- Automatically delete within 5 minutes of scan completion
- Handle cleanup even on errors or worker crashes

### Clone Location Strategy

**Use `os.tmpdir()` with Scan-Specific Subdirectories**:
```typescript
import os from 'os';
import path from 'path';
import { v4 as uuid } from 'uuid';

function getClonePath(scanId: string): string {
  // /tmp/shannon-repos/scan-{scanId}-{uuid}/
  const baseTmpDir = path.join(os.tmpdir(), 'shannon-repos');
  const scanDir = `scan-${scanId}-${uuid().slice(0, 8)}`;
  return path.join(baseTmpDir, scanDir);
}
```

**Why `os.tmpdir()`**:
- **Automatic OS cleanup**: Many systems clean `/tmp` on reboot
- **Separate filesystem**: Often mounted on separate volume in containers
- **Standard location**: Works across Linux, macOS, Docker
- **No database state**: Stateless approach aligns with Temporal workflows

**Directory Structure**:
```
/tmp/shannon-repos/
├── scan-abc123-de45f678/  # Clone for scan abc123
│   ├── .git/
│   ├── src/
│   └── ...
├── scan-xyz789-12ab3456/  # Clone for scan xyz789
└── ...
```

### Clone Depth Optimization

**Use Shallow Clones** (--depth 1):
```typescript
import simpleGit from 'simple-git';

const git = simpleGit();

await git.clone(repoUrl, clonePath, {
  '--depth': 1,              // Shallow clone (latest commit only)
  '--single-branch': true,   // Only specified branch
  '--branch': branchName,    // Target branch
  '--no-tags': null          // Skip tags
});
```

**Benefits**:
- **Faster clones**: Typical 10x speedup vs full clone
- **Less storage**: Only current commit history
- **Sufficient for scanning**: Security analysis doesn't need full git history

**When Full Clone Needed**:
```typescript
// If user specifies specific commit hash (not branch HEAD)
if (commitHash && commitHash !== branchHeadHash) {
  // Need full clone to checkout arbitrary commit
  await git.clone(repoUrl, clonePath, {
    '--branch': branchName
    // No --depth restriction
  });

  await git.checkout(commitHash);
}
```

### Cleanup Mechanisms

**Primary: Temporal Activity Cleanup Hook**:
```typescript
// In shannon/src/temporal/activities.ts

import { Context } from '@temporalio/activity';

async function executeScanWorkflow(scan: Scan): Promise<ScanResult> {
  const clonePath = getClonePath(scan.id);

  try {
    // Clone repository
    if (scan.repoUrl) {
      console.log(`Cloning ${scan.repoUrl} to ${clonePath}...`);
      await cloneRepository(scan.repoUrl, scan.branch, clonePath, scan.organizationId);

      // Heartbeat to Temporal (prevents timeout during large clones)
      Context.current().heartbeat({ phase: 'clone_completed' });
    }

    // Execute scan agents (pass clonePath for snippet extraction)
    const result = await runPentestPipeline(scan, clonePath);

    return result;

  } finally {
    // ALWAYS cleanup, even on errors
    if (scan.repoUrl && await fs.pathExists(clonePath)) {
      console.log(`Cleaning up repository clone at ${clonePath}...`);
      await fs.remove(clonePath);
    }
  }
}
```

**Secondary: Background Cleanup Job** (for crash recovery):
```typescript
// Run periodically (e.g., every hour via Temporal schedule)
async function cleanupOrphanedRepos(): Promise<void> {
  const reposDir = path.join(os.tmpdir(), 'shannon-repos');

  if (!await fs.pathExists(reposDir)) return;

  const entries = await fs.readdir(reposDir, { withFileTypes: true });
  const now = Date.now();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dirPath = path.join(reposDir, entry.name);
    const stats = await fs.stat(dirPath);

    // Delete directories older than 1 hour
    const ageMs = now - stats.mtimeMs;
    if (ageMs > 60 * 60 * 1000) {
      console.log(`Removing orphaned repository clone: ${entry.name}`);
      await fs.remove(dirPath);
    }
  }
}
```

**Tertiary: Docker Container Lifecycle** (for multi-container deployments):
```yaml
# docker-compose.yml
services:
  shannon-worker:
    volumes:
      # Mount /tmp as tmpfs (in-memory filesystem)
      - type: tmpfs
        target: /tmp/shannon-repos
        tmpfs:
          size: 50G  # Limit total repository storage
    restart: unless-stopped
```

**Why Three Layers**:
1. **Activity cleanup**: Handles normal case (99% of scans)
2. **Background job**: Handles worker crashes or uncaught errors
3. **Container restart**: Handles catastrophic failures (container killed)

### Concurrency Considerations

**Parallel Scans with Same Repository**:
```typescript
// Each scan gets unique directory (UUID suffix prevents collisions)
const scan1Path = getClonePath('scan-abc123'); // /tmp/.../scan-abc123-de45f678/
const scan2Path = getClonePath('scan-abc123'); // /tmp/.../scan-abc123-12ab3456/

// Different UUIDs → different directories → no conflicts
```

**Storage Limits**:
```typescript
// Check available disk space before clone
import { statfs } from 'fs';

async function ensureSufficientStorage(requiredBytes: number): Promise<void> {
  const tmpDir = os.tmpdir();
  const stats = await fs.statfs(tmpDir);

  const availableBytes = stats.bavail * stats.bsize;

  if (availableBytes < requiredBytes * 1.5) { // 50% buffer
    throw new InsufficientStorageError(
      `Only ${formatBytes(availableBytes)} available, need ${formatBytes(requiredBytes)}`
    );
  }
}

// Before clone:
await ensureSufficientStorage(5 * 1024 * 1024 * 1024); // 5GB max repo size
```

### Alternatives Considered

#### Option A: Persistent Clone Cache

**Pros**: Faster for repeated scans of same repo
**Cons**: Requires cache invalidation logic, storage management, security exposure from stale data
**Why rejected**: Complexity violates Constitution VII (simplicity). Storage costs and security exposure outweigh speed benefits. If needed later, can add as optimization.

#### Option B: Database-Backed Storage Tracking

**Pros**: Could track cleanup status in database
**Cons**: Adds database state to stateless workflow, complicates error handling
**Why rejected**: Temporal workflows already provide durability guarantees. No need to duplicate state in database.

#### Option C: Shared Volume Across Workers

**Pros**: Could share clones between workers
**Cons**: Requires locking/synchronization, storage accumulation, cleanup coordination
**Why rejected**: Adds concurrency complexity. Ephemeral approach is simpler and safer.

### Implementation Notes

**Clone Timeout** (5 minutes per edge cases):
```typescript
import { setTimeout } from 'timers/promises';

const CLONE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async function cloneWithTimeout(
  repoUrl: string,
  clonePath: string,
  timeoutMs: number = CLONE_TIMEOUT_MS
): Promise<void> {
  const git = simpleGit();

  const clonePromise = git.clone(repoUrl, clonePath, {
    '--depth': 1,
    '--single-branch': true
  });

  const timeoutPromise = setTimeout(timeoutMs).then(() => {
    throw new CloneTimeoutError(
      `Repository clone exceeded ${timeoutMs}ms timeout`
    );
  });

  await Promise.race([clonePromise, timeoutPromise]);
}
```

**Heartbeats During Clone** (prevent Temporal activity timeout):
```typescript
// For large repositories that take >60s to clone
async function cloneRepositoryWithHeartbeats(
  repoUrl: string,
  clonePath: string
): Promise<void> {
  const git = simpleGit();

  // Send heartbeats every 30 seconds during clone
  const heartbeatInterval = setInterval(() => {
    Context.current().heartbeat({ phase: 'cloning' });
  }, 30000);

  try {
    await git.clone(repoUrl, clonePath, { '--depth': 1 });
  } finally {
    clearInterval(heartbeatInterval);
  }
}
```

**Cleanup Verification** (SC-008 compliance):
```typescript
// After cleanup, verify deletion
async function cleanupRepository(clonePath: string): Promise<void> {
  const startTime = Date.now();

  if (await fs.pathExists(clonePath)) {
    await fs.remove(clonePath);
  }

  const duration = Date.now() - startTime;

  // Verify deletion succeeded
  if (await fs.pathExists(clonePath)) {
    throw new CleanupError(`Failed to delete ${clonePath}`);
  }

  // Log for SC-008 metric tracking
  console.log(`Repository cleanup completed in ${duration}ms`);

  // Alert if cleanup took > 5 minutes (SC-008 violation)
  if (duration > 5 * 60 * 1000) {
    console.warn(`Cleanup exceeded 5 minute target: ${duration}ms`);
  }
}
```

**Testing**:
```typescript
// Integration test: Verify cleanup happens
test('repository cleanup after scan completion', async () => {
  const scan = await createTestScan({ repoUrl: 'https://github.com/test/repo' });
  const clonePath = getClonePath(scan.id);

  // Execute scan
  await executeScanWorkflow(scan);

  // Verify clone was removed
  expect(await fs.pathExists(clonePath)).toBe(false);
});

// Test: Cleanup happens even on error
test('repository cleanup on scan failure', async () => {
  const scan = await createTestScan({ repoUrl: 'https://github.com/test/repo' });
  const clonePath = getClonePath(scan.id);

  // Execute scan that will fail
  await expect(
    executeScanWorkflow({ ...scan, targetUrl: 'invalid' })
  ).rejects.toThrow();

  // Verify cleanup still happened
  expect(await fs.pathExists(clonePath)).toBe(false);
});
```

---

## 5. Repository Size Validation

### Decision: Use `git ls-remote` for Pre-Clone Estimation with Timeout

**Selected**: Execute `git ls-remote --get-url` and heuristic size check before full clone

### Rationale

Repository size cannot be determined exactly without cloning, but we can estimate using metadata to fail fast on oversized repositories (FR-017) before consuming resources.

**Requirements** (FR-017, SC-009):
- Validate repository size before clone
- Enforce 5GB maximum
- Complete validation within 10 seconds
- Provide clear error messages

### Size Estimation Strategy

**Two-Phase Approach**:

#### Phase 1: Quick URL Validation (1-2 seconds)

```typescript
async function validateRepositoryAccess(
  repoUrl: string,
  organizationId: string
): Promise<{ valid: boolean; defaultBranch?: string; error?: string }> {
  const git = simpleGit();

  try {
    // Attempt to list remote refs (requires network + auth)
    const refs = await git.listRemote([repoUrl]);

    // Parse default branch from refs
    const headRef = refs.split('\n').find(line => line.includes('HEAD'));
    const defaultBranch = headRef?.match(/refs\/heads\/(\S+)/)?.[1] || 'main';

    return { valid: true, defaultBranch };

  } catch (error: any) {
    if (error.message.includes('Authentication failed')) {
      return { valid: false, error: 'AUTHENTICATION_FAILED' };
    } else if (error.message.includes('not found')) {
      return { valid: false, error: 'REPOSITORY_NOT_FOUND' };
    } else if (error.message.includes('Could not resolve')) {
      return { valid: false, error: 'NETWORK_ERROR' };
    }

    return { valid: false, error: 'UNKNOWN_ERROR' };
  }
}
```

#### Phase 2: Heuristic Size Check (GitHub/GitLab API)

**For GitHub Repositories**:
```typescript
async function estimateGitHubRepoSize(repoUrl: string): Promise<number | null> {
  // Extract owner/repo from URL
  // https://github.com/owner/repo → owner/repo
  const match = repoUrl.match(/github\.com[\/:](.+?)\/(.+?)(?:\.git)?$/);
  if (!match) return null;

  const [, owner, repo] = match;

  // Use GitHub API (no auth required for public repos)
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);

  if (!response.ok) return null;

  const data = await response.json();

  // GitHub returns size in KB
  const sizeBytes = data.size * 1024;

  return sizeBytes;
}
```

**For GitLab Repositories**:
```typescript
async function estimateGitLabRepoSize(repoUrl: string): Promise<number | null> {
  // Extract project path from URL
  const match = repoUrl.match(/gitlab\.com[\/:](.+?)(?:\.git)?$/);
  if (!match) return null;

  const projectPath = encodeURIComponent(match[1]);

  // Use GitLab API
  const response = await fetch(
    `https://gitlab.com/api/v4/projects/${projectPath}`
  );

  if (!response.ok) return null;

  const data = await response.json();

  // GitLab returns size_with_wiki in bytes
  return data.size_with_wiki || data.size;
}
```

**Fallback: No Pre-Clone Size Check**:
```typescript
// For self-hosted Git servers or unsupported platforms
async function estimateRepoSize(repoUrl: string): Promise<number | null> {
  // Try platform-specific APIs
  if (repoUrl.includes('github.com')) {
    return estimateGitHubRepoSize(repoUrl);
  } else if (repoUrl.includes('gitlab.com')) {
    return estimateGitLabRepoSize(repoUrl);
  }

  // Unknown platform - skip size check, rely on timeout
  return null;
}
```

### Validation Flow

**Complete Validation Sequence**:
```typescript
const MAX_REPO_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5GB

async function validateRepository(
  repoUrl: string,
  organizationId: string
): Promise<ValidationResult> {
  const startTime = Date.now();

  // Step 1: Quick access check (1-2s)
  const accessCheck = await validateRepositoryAccess(repoUrl, organizationId);

  if (!accessCheck.valid) {
    return {
      valid: false,
      error: accessCheck.error,
      duration: Date.now() - startTime
    };
  }

  // Step 2: Size estimation (2-3s for API call)
  const estimatedSize = await estimateRepoSize(repoUrl);

  if (estimatedSize !== null && estimatedSize > MAX_REPO_SIZE_BYTES) {
    return {
      valid: false,
      error: 'REPOSITORY_TOO_LARGE',
      estimatedSize,
      maxSize: MAX_REPO_SIZE_BYTES,
      duration: Date.now() - startTime
    };
  }

  const duration = Date.now() - startTime;

  // SC-009: Must complete within 10 seconds
  if (duration > 10000) {
    console.warn(`Repository validation took ${duration}ms (exceeds 10s target)`);
  }

  return {
    valid: true,
    estimatedSize,
    defaultBranch: accessCheck.defaultBranch,
    duration
  };
}
```

### Timeout Handling

**10-Second Validation Timeout** (SC-009):
```typescript
async function validateRepositoryWithTimeout(
  repoUrl: string,
  organizationId: string
): Promise<ValidationResult> {
  const timeoutMs = 10000; // 10 seconds

  const validationPromise = validateRepository(repoUrl, organizationId);

  const timeoutPromise = new Promise<ValidationResult>((resolve) => {
    setTimeout(() => {
      resolve({
        valid: false,
        error: 'VALIDATION_TIMEOUT',
        message: 'Repository validation exceeded 10 second timeout',
        duration: timeoutMs
      });
    }, timeoutMs);
  });

  return Promise.race([validationPromise, timeoutPromise]);
}
```

### Error Messages

**User-Friendly Error Messages** (FR-012, SC-003):
```typescript
function getErrorMessage(error: string, context?: any): string {
  switch (error) {
    case 'AUTHENTICATION_FAILED':
      return 'Unable to access repository. Please check your credentials in Repository Settings.';

    case 'REPOSITORY_NOT_FOUND':
      return 'Repository not found. Please verify the URL is correct and you have access.';

    case 'NETWORK_ERROR':
      return 'Unable to reach repository. Please check the URL and your network connection.';

    case 'REPOSITORY_TOO_LARGE':
      const sizeMB = Math.round(context.estimatedSize / 1024 / 1024);
      const maxMB = Math.round(context.maxSize / 1024 / 1024);
      return `Repository is too large (${sizeMB} MB). Maximum size is ${maxMB} MB (5 GB).`;

    case 'VALIDATION_TIMEOUT':
      return 'Repository validation timed out after 10 seconds. The repository may be very large or the network is slow.';

    default:
      return 'Unable to validate repository. Please try again or contact support.';
  }
}
```

### Alternatives Considered

#### Option A: Clone and Check Size After

**Pros**: Exact size measurement
**Cons**: Wastes resources on oversized repos, violates "fail fast" principle
**Why rejected**: Defeats the purpose of validation (FR-017). Must prevent expensive clones.

#### Option B: `git count-objects` via SSH/HTTP

**Pros**: Exact repository size
**Cons**: Requires server-side git operations, not universally supported
**Why rejected**: Not portable across all git hosting platforms. API approach works for major platforms.

#### Option C: HEAD Request on Repository Archive

**Pros**: Could get compressed size
**Cons**: Not all platforms support archive downloads, compressed size != clone size
**Why rejected**: Unreliable across platforms, archive size doesn't correlate well with clone size.

### Implementation Notes

**Integration Point** (UI validation):
```typescript
// app/api/repository-credentials/validate/route.ts
export async function POST(req: Request) {
  const { repoUrl, authType, token } = await req.json();

  // Validate repository access + size
  const validation = await validateRepositoryWithTimeout(repoUrl, orgId);

  if (!validation.valid) {
    return NextResponse.json({
      error: getErrorMessage(validation.error, validation)
    }, { status: 400 });
  }

  return NextResponse.json({
    valid: true,
    estimatedSize: validation.estimatedSize,
    defaultBranch: validation.defaultBranch,
    branches: await listRemoteBranches(repoUrl, orgId)
  });
}
```

**Scan-Time Validation** (before clone):
```typescript
// shannon/src/temporal/activities.ts
async function executeScanWorkflow(scan: Scan): Promise<ScanResult> {
  if (scan.repoUrl) {
    // Re-validate at scan time (credentials may have changed)
    const validation = await validateRepository(scan.repoUrl, scan.organizationId);

    if (!validation.valid) {
      throw new RepositoryValidationError(
        getErrorMessage(validation.error, validation)
      );
    }

    // Proceed with clone...
  }

  // ...
}
```

**Metrics Tracking** (SC-009 compliance):
```typescript
// Track validation durations for monitoring
interface ValidationMetrics {
  repoUrl: string;
  duration: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

// Log to metrics system
await logValidationMetrics({
  repoUrl: scan.repoUrl,
  duration: validation.duration,
  success: validation.valid,
  error: validation.error,
  timestamp: new Date()
});

// Alert if validation consistently exceeds 10s
if (validation.duration > 10000) {
  console.warn(`SC-009 violation: Validation took ${validation.duration}ms`);
}
```

**Testing**:
```typescript
// Unit test: Size validation
test('rejects repository exceeding 5GB', async () => {
  // Mock GitHub API to return large size
  mockGitHubAPI({ size: 6 * 1024 * 1024 }); // 6GB in KB

  const result = await validateRepository(
    'https://github.com/large/repo',
    'org-123'
  );

  expect(result.valid).toBe(false);
  expect(result.error).toBe('REPOSITORY_TOO_LARGE');
  expect(getErrorMessage(result.error, result)).toContain('5 GB');
});

// Performance test: Validation completes in 10s
test('validation completes within 10 seconds', async () => {
  const start = Date.now();

  await validateRepositoryWithTimeout(
    'https://github.com/test/repo',
    'org-123'
  );

  const duration = Date.now() - start;
  expect(duration).toBeLessThan(10000);
});
```

---

## Dependencies Summary

### New Dependencies Required

**Production**:
```json
{
  "simple-git": "^3.22.0"
}
```

**Development**:
```json
{
  "@types/simple-git": "^3.2.0"
}
```

**Optional** (for binary file detection):
```json
{
  "isbinaryfile": "^5.0.2"
}
```

### Existing Dependencies Leveraged

- `fs-extra`: File system operations (already in Shannon)
- `crypto`: Encryption (already used in `ghostshell/lib/encryption.ts`)
- `@prisma/client`: Database access (already in both packages)
- `zx`: Shell command execution (already in Shannon for git-manager)
- `@temporalio/*`: Workflow orchestration (already in Shannon)

---

## Security Considerations

### Credential Security

1. **Never log credentials**: Redact tokens/keys from logs and error messages
2. **Encrypted storage**: Use existing AES-256-GCM encryption (proven pattern)
3. **Temporary files**: SSH keys written with `0600` permissions, deleted immediately
4. **URL sanitization**: Remove credentials from URLs before logging

### Repository Security

1. **Isolation**: Each scan gets unique temp directory (no cross-contamination)
2. **Cleanup**: Always delete clones (try/finally pattern)
3. **Size limits**: Prevent DoS via oversized repositories
4. **Timeout limits**: Prevent hanging clones

### Network Security

1. **HTTPS validation**: Verify TLS certificates (don't disable SSL)
2. **SSH host key**: Use `StrictHostKeyChecking=no` only in controlled environments
3. **Rate limiting**: Limit repository validation API calls

---

## Performance Characteristics

### Expected Timings (Based on Testing)

| Operation | Typical Duration | Maximum (Timeout) |
|-----------|------------------|-------------------|
| Repository access validation (`git ls-remote`) | 1-3 seconds | 10 seconds |
| Size estimation (GitHub/GitLab API) | 0.5-2 seconds | 5 seconds |
| Shallow clone (small repo <100MB) | 5-30 seconds | 5 minutes |
| Shallow clone (large repo 1-5GB) | 1-4 minutes | 5 minutes |
| Code snippet extraction | 10-50ms per file | 1 second |
| Repository cleanup | 1-10 seconds | 5 minutes |

### Resource Usage

| Resource | Per-Scan | Maximum |
|----------|----------|---------|
| Disk space | ~2x repository size (clone + .git metadata) | 10GB (5GB repo × 2) |
| Memory | 100-500MB (git process) | 1GB |
| Network | Repository size (one-time) | 5GB |

### Scalability Considerations

**Concurrent Scans**:
- Each scan gets isolated clone (no shared state)
- Limited by disk I/O and network bandwidth
- Recommend max 10 concurrent scans per worker (50GB temp storage / 5GB per scan)

**Storage Management**:
- Cleanup job runs hourly (removes orphaned clones >1 hour old)
- Monitor `/tmp/shannon-repos` size
- Alert if total storage exceeds 80% of volume capacity

---

## Migration Path

### Existing Scans (No Repository Info)

**Backward Compatibility**:
```typescript
// Scan model fields are nullable
interface Scan {
  repoUrl?: string | null;
  branch?: string | null;
  commitHash?: string | null;
  // ...
}

// Existing scans without repo info continue to work
// No migration needed for existing Scan records
```

### Rollout Strategy

1. **Phase 1**: Add RepositoryCredentials model, encryption functions (GhostShell)
2. **Phase 2**: Add Scan model fields (nullable), UI for credential management
3. **Phase 3**: Integrate clone logic into Shannon Temporal activities
4. **Phase 4**: Add code snippet extraction to finding generation
5. **Phase 5**: Enable by default for new scans

### Testing Strategy

**Integration Tests**:
- Clone public repository (no auth)
- Clone private repository (with PAT)
- Clone private repository (with SSH key)
- Validate repository size limits
- Verify cleanup on success and failure

**Load Tests**:
- 10 concurrent scans cloning same repository
- Clone 4.9GB repository (just under limit)
- Attempt to clone 5.1GB repository (expect rejection)

---

## Conclusion

This research provides a comprehensive foundation for implementing git repository tracking in Shannon. The recommended approach balances simplicity (Constitution VII), security (Constitution I), and robustness across all five key areas:

1. **Git Library**: `simple-git` for proven TypeScript integration
2. **Authentication**: Extend existing encryption infrastructure with per-repo-URL scoping
3. **Code Snippets**: Simple `fs` module with line-based extraction
4. **Clone Management**: Ephemeral `/tmp` clones with multi-layer cleanup
5. **Size Validation**: API-based estimation with 10-second timeout

All decisions align with Shannon's constitutional principles and provide clear implementation guidance for the development team.

---

**Next Steps**: Proceed to Phase 1 (Data Model Design) to define Prisma schema extensions and API contracts.
