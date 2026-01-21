# Quickstart: Git Repository Tracking for Scans

**Feature**: 011-scan-git-repository
**Date**: 2026-01-21

This guide provides a quick introduction for developers working on the git repository tracking feature.

## Prerequisites

1. **Development Environment**
   - Node.js 20+
   - Git CLI installed
   - PostgreSQL running locally
   - GhostShell and Shannon services configured

2. **Dependencies** (to be installed)
   ```bash
   # In ghostshell directory
   npm install simple-git
   npm install @types/simple-git --save-dev
   ```

## Key Concepts

### Repository Tracking Flow

```
1. User configures scan with repository URL
   ↓
2. System validates URL and resolves credentials
   ↓
3. Scan starts → Repository cloned (shallow, ~10s)
   ↓
4. AI agents analyze code with repository context
   ↓
5. Findings include code snippets (5-line context)
   ↓
6. Scan completes → Repository deleted (<5 min)
```

### Credential Storage

- **Scope**: Per-repository URL within an organization
- **Encryption**: AES-256-GCM (reuses existing infrastructure)
- **Types**: PAT (Personal Access Token) for HTTPS, SSH keys for SSH URLs

## Quick Reference

### Database Changes

```prisma
// Scan model extensions
model Scan {
  repositoryUrl        String?
  repositoryBranch     String?
  repositoryCommitHash String?
}

// New model
model RepositoryCredentials {
  id                  String
  organizationId      String
  repositoryUrl       String  // unique per org
  credentialType      RepositoryCredentialType  // PAT or SSH
  encryptedCredential String
}
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/repository-credentials` | List credentials |
| POST | `/api/repository-credentials` | Add credential |
| DELETE | `/api/repository-credentials/:id` | Remove credential |
| POST | `/api/repository-credentials/validate` | Test access |
| POST | `/api/scans` | Create scan (with repo params) |

### Key Files to Modify

```
ghostshell/
├── prisma/schema.prisma          # Add models
├── lib/git/                      # NEW: Git operations
│   ├── clone.ts                  # Clone with auth
│   ├── cleanup.ts                # Delete repos
│   └── snippet.ts                # Extract code
├── lib/actions/repository.ts     # NEW: Server actions
├── app/api/repository-credentials/  # NEW: API routes
└── components/repository/        # NEW: UI components

shannon/src/
├── temporal/activities.ts        # Extend with clone/cleanup
└── ai/claude-executor.ts         # Pass repo context
```

## Development Tasks

### 1. Schema Migration

```bash
cd ghostshell
npx prisma migrate dev --name add_repository_tracking
npx prisma generate
```

### 2. Git Operations Module

```typescript
// ghostshell/lib/git/clone.ts
import simpleGit from 'simple-git';

export async function cloneRepository(
  url: string,
  branch: string,
  targetDir: string,
  credential?: { type: 'PAT' | 'SSH'; token?: string; keyPath?: string }
) {
  const git = simpleGit();

  // Configure authentication
  if (credential?.type === 'PAT') {
    // Inject token into URL
    const authedUrl = url.replace('https://', `https://oauth2:${credential.token}@`);
    await git.clone(authedUrl, targetDir, ['--depth', '1', '--branch', branch]);
  } else {
    // SSH key handled via GIT_SSH_COMMAND
    await git.clone(url, targetDir, ['--depth', '1', '--branch', branch]);
  }

  // Resolve commit hash
  const localGit = simpleGit(targetDir);
  return await localGit.revparse(['HEAD']);
}
```

### 3. Code Snippet Extraction

```typescript
// ghostshell/lib/git/snippet.ts
import { readFileSync } from 'fs';

export function extractCodeSnippet(
  repoPath: string,
  filePath: string,
  lineNumber: number,
  contextLines = 2
): { snippet: string; lineRange: { start: number; end: number } } {
  const fullPath = `${repoPath}/${filePath}`;
  const content = readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');

  const start = Math.max(0, lineNumber - contextLines - 1);
  const end = Math.min(lines.length - 1, lineNumber + contextLines - 1);

  return {
    snippet: lines.slice(start, end + 1).join('\n'),
    lineRange: { start: start + 1, end: end + 1 }
  };
}
```

## Testing

### Unit Tests

```typescript
// ghostshell/__tests__/unit/git-operations.test.ts
import { describe, it, expect, vi } from 'vitest';
import { cloneRepository } from '@/lib/git/clone';

describe('cloneRepository', () => {
  it('should clone with PAT authentication', async () => {
    // Mock simple-git
    const mockGit = { clone: vi.fn(), revparse: vi.fn(() => 'abc123') };
    vi.mock('simple-git', () => ({ default: () => mockGit }));

    const hash = await cloneRepository(
      'https://github.com/test/repo',
      'main',
      '/tmp/test',
      { type: 'PAT', token: 'test-token' }
    );

    expect(hash).toBe('abc123');
    expect(mockGit.clone).toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
// ghostshell/__tests__/integration/repository-credentials.spec.ts
import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';

describe('Repository Credentials API', () => {
  it('should create and retrieve credentials', async () => {
    // Test credential CRUD
  });

  it('should validate repository access', async () => {
    // Test validation endpoint
  });
});
```

## Common Scenarios

### Adding a GitHub Repository

```typescript
// 1. Store credential (once per repo URL)
await fetch('/api/repository-credentials', {
  method: 'POST',
  body: JSON.stringify({
    repositoryUrl: 'https://github.com/acme/webapp',
    credentialType: 'PAT',
    credential: { token: 'ghp_xxxxx' },
    name: 'ACME Webapp'
  })
});

// 2. Start scan with repository
await fetch('/api/scans', {
  method: 'POST',
  body: JSON.stringify({
    projectId: 'proj123',
    repositoryUrl: 'https://github.com/acme/webapp',
    repositoryBranch: 'main'
  })
});
```

### Filtering Scans by Repository

```typescript
// In scan list component
const scans = await db.scan.findMany({
  where: {
    organizationId: orgId,
    repositoryUrl: 'https://github.com/acme/webapp',
    repositoryBranch: 'main'
  },
  orderBy: { createdAt: 'desc' }
});
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Clone timeout | Large repository | Use shallow clone (`--depth 1`) |
| Auth failure | Invalid PAT/SSH key | Verify token permissions |
| Size limit exceeded | Repo > 5GB | Use different repo or contact support |
| Missing git CLI | Docker image issue | Ensure `git` in container |

## Resources

- [Spec Document](spec.md) - Full feature specification
- [Research Document](research.md) - Technical decisions and rationale
- [Data Model](data-model.md) - Database schema details
- [API Contracts](contracts/openapi.yaml) - OpenAPI specification
- [simple-git Documentation](https://github.com/steveukx/git-js)

## Next Steps

1. Run `/speckit.tasks` to generate detailed implementation tasks
2. Start with P1 (version tracking) before P2/P3
3. Test with public repos first, then add credential support
