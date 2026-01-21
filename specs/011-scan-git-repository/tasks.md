# Tasks: Git Repository Tracking for Scans

**Input**: Design documents from `/specs/011-scan-git-repository/`
**Prerequisites**: plan.md, spec.md (with 7 clarifications), research.md, data-model.md, contracts/openapi.yaml

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Key Clarifications Incorporated**:
- FR-018: Entire repository scanning only (no subdirectory support)
- Credential snapshot at scan start (changes don't affect in-progress scans)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **GhostShell (Web App)**: `ghostshell/` - Next.js frontend + API
- **Shannon (Scan Engine)**: `shannon/src/` - Temporal workflows + Claude Agent SDK

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependencies

- [X] T001 Install simple-git dependency in ghostshell/package.json
- [X] T002 [P] Create git operations directory structure at ghostshell/lib/git/
- [X] T003 [P] Create repository components directory at ghostshell/components/repository/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Database Schema

- [X] T004 Add CredentialType enum (PAT, SSH) to ghostshell/prisma/schema.prisma
- [X] T005 Add repository fields (repositoryUrl, repositoryBranch, repositoryCommitHash) to Scan model in ghostshell/prisma/schema.prisma
- [X] T006 Add RepositoryCredentials model with unique constraint [organizationId, repositoryUrl] in ghostshell/prisma/schema.prisma
- [X] T007 Add default repository fields (defaultRepositoryUrl, defaultRepositoryBranch) to Project model in ghostshell/prisma/schema.prisma
- [X] T008 Add Organization relation to RepositoryCredentials model in ghostshell/prisma/schema.prisma
- [X] T009 Run Prisma migration: `npx prisma migrate dev --name add_repository_tracking` (applied via db push)

### Git Operations Library

- [X] T010 [P] Create repository URL validation utilities (HTTPS and SSH formats) in ghostshell/lib/git/validation.ts
- [X] T011 [P] Create repository URL normalization function (remove .git suffix, trailing slash) in ghostshell/lib/git/normalize.ts
- [X] T012 Implement git clone with PAT authentication (inject token into HTTPS URL) in ghostshell/lib/git/clone.ts
- [X] T013 Implement git clone with SSH key authentication (GIT_SSH_COMMAND) in ghostshell/lib/git/clone.ts
- [X] T014 [P] Implement repository cleanup function (delete cloned directory) in ghostshell/lib/git/cleanup.ts
- [X] T015 [P] Implement code snippet extraction (5 lines context, handle binary/large files) in ghostshell/lib/git/snippet.ts
- [X] T016 Implement git ls-remote for repository validation (10s timeout per SC-003) in ghostshell/lib/git/validate-access.ts
- [X] T017 Implement repository size estimation using git ls-remote in ghostshell/lib/git/validate-access.ts
- [X] T018 Add 5GB size limit validation with clear error message (FR-017) in ghostshell/lib/git/validate-access.ts

### Credential Encryption

- [X] T019 Create credential encryption/decryption functions reusing existing AES-256-GCM infrastructure in ghostshell/lib/git/encryption.ts

### TypeScript Types

- [X] T020 [P] Create CodeLocation interface and FindingEvidence type extension in ghostshell/lib/types/repository.ts
- [X] T021 [P] Create RepositoryValidationResult interface in ghostshell/lib/types/repository.ts
- [X] T022 [P] Create CreateCredentialInput and CreateScanInput interfaces in ghostshell/lib/types/repository.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Track Scanned Code Version (Priority: P1) MVP

**Goal**: Each scan records which specific version of source code was analyzed for reproducibility

**Independent Test**: Run a scan with repository URL and commit hash, verify scan record shows this information and findings link to specific code

### Repository Credentials API (US1)

- [X] T023 [P] [US1] Create POST /api/repository-credentials route for credential creation in ghostshell/app/api/repository-credentials/route.ts
- [X] T024 [P] [US1] Create GET /api/repository-credentials route to list credentials (without decrypted secrets) in ghostshell/app/api/repository-credentials/route.ts
- [X] T025 [US1] Create GET /api/repository-credentials/[id]/route.ts for single credential fetch
- [X] T026 [US1] Create PATCH /api/repository-credentials/[id]/route.ts for credential update
- [X] T027 [US1] Create DELETE /api/repository-credentials/[id]/route.ts for credential removal
- [X] T028 [US1] Create POST /api/repository-credentials/validate/route.ts for testing repository access (returns valid/error type)

### Scan API Extensions (US1)

- [X] T029 [US1] Extend POST /api/scans to accept repositoryUrl, repositoryBranch, repositoryCommitHash in existing scan creation route
- [X] T030 [US1] Extend GET /api/scans/[id] to return repository fields in scan detail response
- [X] T031 [US1] Add logic to inherit defaultRepositoryUrl/Branch from Project when not provided in scan creation
- [X] T032 [US1] Add credential snapshot logic - resolve and cache credential at scan creation time (per clarification)

### Shannon Temporal Integration (US1)

- [X] T033 [US1] Create cloneRepository activity that receives pre-resolved credential in shannon/src/temporal/activities.ts
- [X] T034 [US1] Add shallow clone with --depth 1 for performance in cloneRepository activity
- [X] T035 [US1] Add commit hash resolution (git rev-parse HEAD) when only branch provided in shannon/src/temporal/activities.ts
- [X] T036 [US1] Create cleanupRepository activity to delete cloned repo (within 5 min per SC-008) in shannon/src/temporal/activities.ts
- [X] T037 [US1] Extend pentestPipelineWorkflow to call cloneRepository at scan start in shannon/src/temporal/workflows.ts
- [X] T038 [US1] Extend pentestPipelineWorkflow to call cleanupRepository after scan completion (including failures) in shannon/src/temporal/workflows.ts
- [X] T039 [US1] Pass repository path to Claude executor for code context in shannon/src/ai/claude-executor.ts

### Code Snippet Integration (US1)

- [ ] T040 [US1] Implement extractCodeSnippet function call during finding generation in shannon/src/ai/claude-executor.ts (BLOCKED: needs finding import architecture)
- [ ] T041 [US1] Add codeLocation field to Finding.evidence JSON structure in finding generation (BLOCKED: needs finding import architecture)
- [X] T042 [US1] Handle binary file edge case (skip snippet extraction) in snippet-processor.ts
- [X] T043 [US1] Handle large file edge case (>10MB, skip snippet) in snippet-processor.ts
- [X] T044 [US1] Handle UTF-8 encoding errors gracefully in snippet-processor.ts

**Note**: T040-T041 are blocked pending architecture decision on finding import mechanism. The snippet extraction utility is implemented and tested, but integration requires a finding import flow that doesn't currently exist. Deliverables: shannon/src/utils/snippet-processor.ts (ready for future integration).

### Scan Configuration UI (US1)

- [X] T045 [P] [US1] Create RepositoryInput component with URL, branch, commit fields in ghostshell/components/repository/RepositoryInput.tsx
- [X] T046 [P] [US1] Create RepositoryValidationIndicator component for async validation feedback in ghostshell/components/repository/ValidationIndicator.tsx
- [X] T047 [US1] Integrate RepositoryInput into scan creation form in ghostshell/components/scans/
- [X] T048 [US1] Add "entire repository will be scanned" note in UI (per FR-018 clarification)

### Scan Details UI (US1)

- [X] T049 [US1] Display repository URL, branch, and commit hash in scan details page
- [ ] T050 [US1] Display code snippet with line numbers in finding details view (BLOCKED: depends on T040-T044)
- [X] T051 [US1] Add clickable link to repository (external link icon) in scan details

**Checkpoint**: User Story 1 complete - scans track repository version with code snippets in findings

---

## Phase 4: User Story 2 - Branch-Specific Scanning (Priority: P2)

**Goal**: Scan different git branches separately and track security differences across environments

**Independent Test**: Run scans against different branches of the same repository, verify each scan tracks its branch independently

### Scan Filtering API (US2)

- [X] T052 [US2] Extend GET /api/scans to support filtering by repositoryUrl query parameter
- [X] T053 [US2] Extend GET /api/scans to support filtering by repositoryBranch query parameter
- [X] T054 [US2] Ensure filter queries complete within 2 seconds (SC-002) with existing indexes

### Branch Comparison (US2)

- [X] T055 [US2] Create GET /api/scans/compare endpoint accepting two scan IDs for finding comparison
- [X] T056 [US2] Implement findingsDiff function to identify branch-specific vs common findings

### Scan History UI (US2)

- [X] T057 [P] [US2] Create RepositoryFilter component with URL and branch dropdowns in ghostshell/components/scans/RepositoryFilter.tsx
- [X] T058 [US2] Integrate RepositoryFilter into scan list page
- [X] T059 [US2] Display branch badge/tag on scan cards in list view

### Branch Comparison UI (US2)

- [ ] T060 [P] [US2] Create ScanComparison component to show side-by-side findings in ghostshell/components/scans/ScanComparison.tsx
- [ ] T061 [US2] Add "Compare with..." action button to scan detail page
- [ ] T062 [US2] Highlight branch-specific findings (unique to one branch) in comparison view

**Checkpoint**: User Story 2 complete - users can filter scans by branch and compare findings across branches

---

## Phase 5: User Story 3 - Multi-Repository Projects (Priority: P3)

**Goal**: Scan different repositories within the same project for microservices security assessment

**Independent Test**: Run scans with different repository URLs under the same project, verify each scan maintains accurate repository associations

### Project Repository Settings API (US3)

- [ ] T063 [US3] Extend PATCH /api/projects/[id] to accept defaultRepositoryUrl and defaultRepositoryBranch

### Repository Credentials Management UI (US3)

- [ ] T064 [P] [US3] Create CredentialList component to display all org credentials in ghostshell/components/repository/CredentialList.tsx
- [ ] T065 [P] [US3] Create CredentialForm component for PAT/SSH credential input with validation in ghostshell/components/repository/CredentialForm.tsx
- [ ] T066 [US3] Create repository credentials settings page at ghostshell/app/(dashboard)/settings/repository-credentials/page.tsx
- [ ] T067 [US3] Add credential validation status indicator (valid/invalid/untested) to credential list
- [ ] T068 [US3] Add "credential in use by N scans" indicator before allowing deletion

### Project Settings UI (US3)

- [ ] T069 [US3] Add default repository configuration section to project settings page
- [ ] T070 [US3] Create DefaultRepositoryForm component for project-level defaults in ghostshell/components/projects/DefaultRepositoryForm.tsx
- [ ] T071 [US3] Show credential connection status for project's default repository

### Multi-Repository Grouping (US3)

- [ ] T072 [US3] Add repository grouping option to scan list (group by repository URL)
- [ ] T073 [US3] Create RepositoryGroupHeader component showing repo summary stats in ghostshell/components/scans/RepositoryGroupHeader.tsx
- [ ] T074 [US3] Display repository badge/tag in finding list to show which repo finding came from

**Checkpoint**: User Story 3 complete - projects support multiple repositories with credential management UI

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Error Handling

- [ ] T075 [P] Add specific error messages distinguishing auth failures vs network errors vs invalid URLs (FR-012) in git operations
- [ ] T076 [P] Add clone timeout handling (5 minutes) - proceed with URL-only scan and log warning
- [ ] T077 Handle commit-not-found error with suggestion to use branch name instead

### Security Hardening

- [ ] T078 [P] Ensure credentials are never logged or included in error messages (redact from all logs)
- [ ] T079 [P] Add audit logging for credential create/update/delete operations to AuditLog table
- [ ] T080 Set strict file permissions (0o600) for temporary SSH key files and cleanup after use

### Export Integration

- [ ] T081 [P] Include repository metadata (URL, branch, commit) in PDF scan report export
- [ ] T082 [P] Include repository metadata in JSON scan export

### Validation

- [ ] T083 Run quickstart.md scenarios to validate end-to-end flow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on User Story 1 minimum being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses US1 scan creation but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Uses US1 credential storage but independently testable

### Within Each User Story

- API routes before UI components (UI depends on API)
- Temporal activities before workflow integration
- Core implementation before UI integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel
- T010-T011 (validation/normalization) parallel
- T014-T015 (cleanup/snippet) parallel
- T020-T022 (types) parallel
- Once Foundational phase completes, all user stories can start in parallel
- Within US1: T023-T024 (credentials routes) parallel, T045-T046 (UI components) parallel
- Within US2: T057, T060 (UI components) parallel
- Within US3: T064-T065 (UI components) parallel
- Polish phase: T075-T076, T078-T079, T081-T082 all parallel

---

## Parallel Example: Foundational Phase

```bash
# Launch validation and normalization utilities together:
Task: "Create repository URL validation utilities in ghostshell/lib/git/validation.ts"
Task: "Create repository URL normalization function in ghostshell/lib/git/normalize.ts"

# Launch cleanup and snippet extraction together:
Task: "Implement repository cleanup function in ghostshell/lib/git/cleanup.ts"
Task: "Implement code snippet extraction in ghostshell/lib/git/snippet.ts"

# Launch all type definitions together:
Task: "Create CodeLocation interface in ghostshell/lib/types/repository.ts"
Task: "Create RepositoryValidationResult interface in ghostshell/lib/types/repository.ts"
Task: "Create CreateCredentialInput interface in ghostshell/lib/types/repository.ts"
```

## Parallel Example: User Story 1

```bash
# Launch credential API routes together:
Task: "Create POST /api/repository-credentials route in ghostshell/app/api/repository-credentials/route.ts"
Task: "Create GET /api/repository-credentials route in ghostshell/app/api/repository-credentials/route.ts"

# Launch UI components together:
Task: "Create RepositoryInput component in ghostshell/components/repository/RepositoryInput.tsx"
Task: "Create RepositoryValidationIndicator component in ghostshell/components/repository/ValidationIndicator.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (3 tasks)
2. Complete Phase 2: Foundational (19 tasks)
3. Complete Phase 3: User Story 1 (29 tasks)
4. **STOP and VALIDATE**: Test scan with repository → verify code snippets appear in findings
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (branch filtering)
4. Add User Story 3 → Test independently → Deploy/Demo (multi-repo + credential UI)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (API routes + Shannon integration)
   - Developer B: User Story 1 (UI components)
   - After US1: Split US2 and US3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Repository credentials are encrypted with existing AES-256-GCM infrastructure
- Credentials snapshot at scan start - changes don't affect in-progress scans
- Cloned repositories auto-delete within 5 minutes of scan completion
- Maximum repository size: 5GB
- Entire repository is scanned (no subdirectory support per FR-018)
