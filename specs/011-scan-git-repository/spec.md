# Feature Specification: Git Repository Tracking for Scans

**Feature Branch**: `011-scan-git-repository`
**Created**: 2026-01-21
**Status**: Draft
**Input**: User description: "Add git repository field to scan model for tracking source code location"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Track Scanned Code Version (Priority: P1)

As a security engineer, I want each scan to record which specific version of source code was analyzed so that I can correlate findings with exact commits and ensure reproducibility of security assessments.

**Why this priority**: This is the core value - without knowing which code version was scanned, security findings cannot be reliably reproduced, fixed, or verified. This is fundamental for actionable security reporting.

**Independent Test**: Can be fully tested by running a scan with a specified repository URL and commit hash, then verifying the scan record shows this information and findings can be linked to specific code.

**Acceptance Scenarios**:

1. **Given** I am starting a new scan, **When** I configure the scan, **Then** I can optionally specify a git repository URL, branch, and commit hash that will be analyzed.

2. **Given** a scan has completed, **When** I view the scan details, **Then** I see the exact repository URL, branch, and commit hash that was scanned (if provided).

3. **Given** I am viewing scan findings, **When** I examine a specific vulnerability, **Then** I can see the file path, line number, and a code snippet with 5 lines of context showing the vulnerable code without needing to open the repository.

4. **Given** my project has a default repository URL configured, **When** I start a scan without specifying a repository, **Then** the scan automatically uses the project's default repository settings.

---

### User Story 2 - Branch-Specific Scanning (Priority: P2)

As a DevOps engineer, I want to scan different git branches (main, staging, feature branches) separately so that I can track security differences across environments and development workflows.

**Why this priority**: Different branches represent different code states. Scanning specific branches enables environment-specific security testing and PR-based scanning workflows.

**Independent Test**: Can be tested by running scans against different branches of the same repository and verifying each scan tracks its branch independently with accurate findings.

**Acceptance Scenarios**:

1. **Given** I am configuring a scan, **When** I specify a repository URL, **Then** I can select or enter a specific branch name to scan.

2. **Given** I have multiple scans for the same repository, **When** I filter scan history, **Then** I can filter by branch to see all scans for a specific branch.

3. **Given** I am viewing scan results, **When** I compare scans from different branches, **Then** I can easily identify which findings are branch-specific versus common across branches.

---

### User Story 3 - Multi-Repository Projects (Priority: P3)

As a development team lead, I want to scan different repositories within the same project so that I can assess security across microservices or monorepo structures without creating separate projects.

**Why this priority**: Modern applications often span multiple repositories. Supporting multiple repositories per project enables comprehensive security coverage without organizational overhead.

**Independent Test**: Can be tested by running scans with different repository URLs under the same project and verifying each scan maintains accurate repository associations.

**Acceptance Scenarios**:

1. **Given** I am configuring a scan, **When** I specify a repository URL, **Then** I can override the project's default repository URL for this specific scan.

2. **Given** I have scans from multiple repositories in one project, **When** I view scan history, **Then** I can see which repository each scan analyzed.

3. **Given** I am viewing project-level security metrics, **When** I review findings, **Then** findings are grouped by repository for easy comparison.

---

### Edge Cases

- What happens when a repository URL is invalid or inaccessible? The scan should fail with a clear error message indicating the repository could not be accessed, and the error should distinguish between network issues, authentication failures, and invalid URLs.

- How does the system handle when a specified commit hash no longer exists (e.g., force-pushed branch)? The scan should fail with a specific error indicating the commit is not found, and suggest using a branch name instead.

- What happens if a scan specifies a branch but no commit hash? The scan should record the commit hash of the branch HEAD at scan start time, ensuring reproducibility even if the branch moves later.

- How does the system handle very large repositories? The system enforces a maximum repository size limit of 5GB to prevent resource exhaustion. Repositories exceeding this limit will fail with a clear error message. For repositories under 5GB, if cloning cannot complete within the timeout period (5 minutes), the scan proceeds with URL-only scanning and notes the repository was not analyzed. Cloned repositories are automatically deleted after scan completion to avoid storage accumulation.

- What happens when scanning a private repository without credentials? The scan should detect the authentication failure and provide clear guidance on how to configure repository access credentials (personal access token for HTTPS repositories or SSH key for SSH repositories).

- What happens if a credential is updated or deleted during an active scan? The system resolves and caches credentials at scan start time. Changes to credentials (updates, deletions) do not affect in-progress scans. This ensures scan reproducibility and prevents mid-scan failures from credential rotation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to specify a git repository URL when configuring a scan
- **FR-002**: System MUST allow users to specify a git branch name when configuring a scan with a repository URL
- **FR-003**: System MUST allow users to specify a git commit hash when configuring a scan with a repository URL
- **FR-004**: System MUST record the repository URL, branch, and commit hash with each scan that includes this information
- **FR-005**: System MUST automatically resolve and record the commit hash if only a branch name is provided
- **FR-006**: System MUST use the project's default repository URL if no scan-specific repository is specified
- **FR-007**: System MUST validate repository URLs before starting a scan and fail fast with specific error messages if validation fails
- **FR-008**: System MUST display repository information (URL, branch, commit) in scan details views
- **FR-009**: System MUST support filtering scan history by repository URL and branch
- **FR-010**: System MUST link findings to specific source code locations including file path, line number, and code snippet with 5 lines of context when repository information is available
- **FR-011**: System MUST support both public and private repositories with authentication via personal access tokens (PAT) for HTTPS URLs and SSH keys for SSH URLs
- **FR-012**: System MUST handle repository access failures gracefully, distinguishing between network errors, authentication failures, and invalid URLs
- **FR-013**: System MUST store repository credentials securely at the per-repository URL level within an organization, using the same encryption standards as authentication credentials, allowing credential reuse across projects accessing the same repository
- **FR-014**: System MUST allow comparing security findings between different commits or branches of the same repository
- **FR-015**: System MUST include repository metadata in exported scan reports (PDF and JSON formats)
- **FR-016**: System MUST clone repositories at scan start, maintain the clone for the scan duration to extract code snippets, and automatically delete the clone after scan completion to minimize storage footprint and security exposure
- **FR-017**: System MUST enforce a maximum repository size limit of 5GB to prevent resource exhaustion, providing clear error messages when repositories exceed this limit
- **FR-018**: System MUST scan the entire repository; subdirectory-scoped scanning is explicitly out of scope for this feature

### Key Entities

- **Scan**: Extended to include repository URL (string), branch name (string), and commit hash (string) fields
- **RepositoryCredentials**: Stores authentication information (personal access tokens for HTTPS, SSH private keys for SSH) for accessing private repositories, scoped per-repository URL within an organization to enable credential reuse across projects while maintaining security isolation between different repositories
- **FindingCodeLocation**: Associates security findings with specific files and line numbers in the scanned repository, includes file path, line number, and code snippet with 5 lines of surrounding context for immediate triage

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of scans with repository information can be traced to an exact commit hash for reproducibility
- **SC-002**: Users can filter scan history by repository or branch and see results within 2 seconds
- **SC-003**: Repository validation completes within 10 seconds and provides specific error messages for common failure modes
- **SC-004**: 90% of findings from repository-linked scans include direct links to source code locations
- **SC-005**: Users can compare security posture across branches by viewing scans side-by-side grouped by repository
- **SC-006**: Repository credentials are encrypted at rest using the same security standards as authentication credentials
- **SC-007**: Users can configure repository settings through the UI without editing configuration files
- **SC-008**: Repository clones are automatically deleted within 5 minutes of scan completion to minimize storage costs and security exposure
- **SC-009**: Repository size validation completes within 10 seconds and provides clear error messages when repositories exceed the 5GB limit

## Clarifications

### Session 2026-01-21

- Q: At what level should repository credentials be stored and managed? → A: Per-repository URL within an organization
- Q: Which authentication methods should be supported for accessing private git repositories? → A: Personal access tokens (PAT) and SSH keys
- Q: What level of detail should be included when linking findings to source code locations? → A: File path, line number, and code snippet (5 lines context)
- Q: When should the system clone or access the git repository during a scan? → A: Clone at scan start, cache for scan duration, delete after
- Q: Should there be a maximum repository size limit to prevent resource exhaustion? → A: Yes - 5GB limit for repositories
- Q: Should the system support scanning a specific subdirectory within a repository? → A: No - scan entire repository only (simplest approach)
- Q: How should the system handle credential changes during an active scan? → A: Snapshot at start - credential resolved once at scan start; changes don't affect in-progress scans

## Assumptions

- Users have necessary permissions to access the git repositories they want to scan
- Git repositories are hosted on accessible platforms (GitHub, GitLab, Bitbucket, or self-hosted Git servers)
- Repository URLs follow standard git URL formats (HTTPS or SSH)
- The Shannon scanning engine can be extended to accept repository information as part of scan configuration
- Users understand basic git concepts (repository, branch, commit hash)
- Repository credentials are managed separately from application authentication credentials
- Network connectivity allows cloning repositories within reasonable timeouts (5 minutes)
