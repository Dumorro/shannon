# Implementation Plan: Git Repository Tracking for Scans

**Branch**: `011-scan-git-repository` | **Date**: 2026-01-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/011-scan-git-repository/spec.md`

## Summary

Implement git repository tracking capabilities for security scans to enable reproducible security assessments. The core functionality includes tracking repository URL, branch, and commit hash for each scan (P1), branch-specific scanning for environment testing (P2), and multi-repository support for microservices (P3). Code snippets with 5 lines of context are embedded in findings for immediate triage without requiring repository access. Repositories are cloned at scan start, cached during execution, and automatically deleted after completion to minimize storage footprint.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20+)
**Primary Dependencies**:
- **Web App**: Next.js 16, React 19, Clerk (auth), TailwindCSS 4
- **Database**: Prisma 7.2 ORM with PostgreSQL
- **Git Operations**: Node.js built-in `child_process` for git commands, or `simple-git` library
- **File System**: Node.js `fs` module for repository storage and cleanup

**Storage**: PostgreSQL (Prisma for database), ephemeral filesystem for repository clones (auto-deleted post-scan)
**Testing**: Vitest (unit and integration tests), @testing-library/react (component tests)
**Target Platform**: Web (Next.js App Router) + Docker containers for scan execution
**Project Type**: Web application (monorepo: `ghostshell/` frontend + API, `shannon/` scanning engine)

**Performance Goals**:
- Repository validation completes within 10 seconds (SC-003)
- Filter scan history by repository/branch in under 2 seconds (SC-002)
- Repository clones deleted within 5 minutes of scan completion (SC-008)
- Repository size validation completes within 10 seconds (SC-009)

**Constraints**:
- Maximum repository size: 5GB (FR-017)
- Clone timeout: 5 minutes (Edge Case)
- Support HTTPS (PAT) and SSH (key) authentication (FR-011)
- Per-repository URL credential storage within organizations (FR-013)

**Scale/Scope**: Multi-tenant SaaS, extends existing scan infrastructure with repository metadata tracking

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Security-First | ✅ PASS | Repository credentials encrypted with same standards as auth credentials (FR-013), SSH keys and PATs stored securely (FR-011), automatic credential cleanup via per-repo scoping |
| II. AI-Native Architecture | ✅ PASS | Extends existing Claude Agent SDK scanning infrastructure, repositories provide code context for AI analysis |
| III. Multi-Tenant Isolation | ✅ PASS | Repository credentials scoped per-repository URL within organization (FR-013), scan data includes organizationId for tenant isolation |
| IV. Temporal-First Orchestration | ✅ PASS | Repository cloning occurs within Temporal scan activities, leveraging existing pentest workflow infrastructure |
| V. Progressive Delivery | ✅ PASS | 3 user stories prioritized P1-P3, each independently testable (P1: version tracking, P2: branch scanning, P3: multi-repo) |
| VI. Observability-Driven | ✅ PASS | Repository access failures distinguished (network, auth, invalid URLs per FR-012), clone/delete events logged, size validation errors surfaced |
| VII. Simplicity | ✅ PASS | Extends existing Scan model with 3 fields (repoUrl, branch, commitHash), reuses existing encryption infrastructure, uses native git commands |

**Gate Result**: PASS - All constitutional principles satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/011-scan-git-repository/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (git libraries, auth patterns)
├── data-model.md        # Phase 1 output (Scan extensions, RepositoryCredentials)
├── quickstart.md        # Phase 1 output (developer guide)
├── contracts/           # Phase 1 output (API endpoints for repo config)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
ghostshell/                     # Next.js web application
├── app/
│   ├── (dashboard)/
│   │   ├── scans/              # Extends existing: add repo config to scan form
│   │   ├── projects/           # Extends existing: add default repo settings
│   │   └── settings/           # NEW: repository credentials management UI
│   └── api/
│       ├── scans/              # Extends existing: accept repo params
│       ├── repository-credentials/  # NEW: CRUD for repo credentials
│       └── webhooks/           # Existing: temporal webhooks
├── components/
│   ├── scans/                  # Extends existing: repo input fields
│   ├── repository/             # NEW: credential form, repo validation
│   └── ui/                     # Reuse existing primitives
├── lib/
│   ├── actions/                # NEW: repository validation actions
│   ├── git/                    # NEW: git operations (clone, resolve, cleanup)
│   └── *.ts                    # Extends: encryption, db, types
└── prisma/
    └── schema.prisma           # Extends: Scan + RepositoryCredentials models

shannon/src/                    # Scanning engine (Temporal workers)
├── temporal/
│   ├── activities.ts           # Extends: clone repo before scan, cleanup after
│   └── workflows.ts            # Extends: pass repo info to AI agents
├── ai/
│   └── claude-executor.ts      # Extends: mount repo path, extract code snippets
└── audit/
    └── session-manager.ts      # Extends: log repo metadata
```

**Structure Decision**: Web application pattern with clear separation:
- `ghostshell/` - UI for repository configuration and credential management
- `shannon/` - Git operations integrated into scan execution workflow

New development focuses on:
1. Extending Scan model with repository fields (url, branch, commitHash)
2. Adding RepositoryCredentials model with per-repo-URL scoping
3. Implementing git clone/cleanup in Temporal scan activities
4. Adding repository validation and code snippet extraction to finding generation
5. Building credential management UI in settings

## Complexity Tracking

> No violations - complexity justified by constitutional alignment.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Repository credentials | AES-256-GCM per-repo-URL scoping | Constitution I requires strong encryption, III requires isolation |
| Ephemeral clones | Clone → cache → delete pattern | Constitution VII: simplest secure approach, avoids persistent storage overhead |
| Git CLI vs library | Use simple-git library | Balance simplicity (Constitution VII) with error handling (Constitution VI) |
| Code snippet storage | Store in Finding.evidence JSON | Constitution VII: reuse existing schema, avoid new tables |

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Post-Design Evidence |
|-----------|--------|----------------------|
| I. Security-First | ✅ PASS | RepositoryCredentials encrypted at rest, SSH keys stored securely, automatic cleanup prevents data leakage |
| II. AI-Native Architecture | ✅ PASS | Repository clones provide code context to Claude Agent SDK, snippets embedded in AI analysis |
| III. Multi-Tenant Isolation | ✅ PASS | RepositoryCredentials.organizationId enforces tenant boundaries, Scan.organizationId maintained |
| IV. Temporal-First Orchestration | ✅ PASS | Clone activities integrated into existing pentest workflow, cleanup via workflow completion |
| V. Progressive Delivery | ✅ PASS | Data model supports incremental rollout (P1→P3), each priority independently deployable |
| VI. Observability-Driven | ✅ PASS | Repository validation errors categorized (network/auth/invalid), clone/cleanup events logged with metrics |
| VII. Simplicity | ✅ PASS | Extends existing Scan model (3 fields), reuses encryption infrastructure, simple-git library for robust git ops |

**Post-Design Gate Result**: PASS - All constitutional principles remain satisfied after design decisions.

## Generated Artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Research | [research.md](research.md) | Git library comparison, authentication patterns, code extraction strategies |
| Data Model | [data-model.md](data-model.md) | Scan extensions, RepositoryCredentials entity, FindingCodeLocation structure |
| API Contracts | [contracts/openapi.yaml](contracts/openapi.yaml) | Repository credential CRUD, scan configuration with repo params |
| Quickstart | [quickstart.md](quickstart.md) | Developer onboarding for git integration and testing |

## Next Steps

1. **Phase 0**: Generate `research.md` with technology decisions
2. **Phase 1**: Generate `data-model.md`, `contracts/`, and `quickstart.md`
3. Run `/speckit.tasks` to generate implementation tasks from this plan
4. Review and approve generated tasks
5. Begin implementation following priority order (P1 → P2 → P3)
