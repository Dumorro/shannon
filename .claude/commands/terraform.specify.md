---
description: Create infrastructure specification for Terraform IaC from natural language description.
handoffs:
  - label: Build Technical Plan
    agent: terraform.plan
    prompt: Create implementation plan for the infrastructure specification
  - label: Generate Terraform Tasks
    agent: speckit.tasks
    prompt: Generate tasks for Terraform implementation
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

The text the user typed after `/terraform.specify` in the triggering message **is** the infrastructure description. Assume you always have it available in this conversation even if `$ARGUMENTS` appears literally below. Do not ask the user to repeat it unless they provided an empty command.

Given that infrastructure description, do this:

1. **Generate a concise short name** (2-4 words) for the branch:
   - Analyze the infrastructure description and extract meaningful keywords
   - Use infra-noun format (e.g., "aws-vpc-setup", "gcp-gke-cluster", "azure-aks-infra")
   - Preserve cloud provider names and service acronyms (AWS, GCP, Azure, VPC, EKS, RDS)
   - Examples:
     - "Set up AWS VPC with public and private subnets" → "aws-vpc-networking"
     - "Create GKE cluster with autoscaling" → "gcp-gke-cluster"
     - "Deploy Azure AKS with monitoring" → "azure-aks-monitoring"

2. **Check for existing branches before creating new one**:

   a. First, fetch all remote branches:
      ```bash
      git fetch --all --prune
      ```

   b. Find the highest feature number across all sources for the short-name:
      - Remote branches: `git ls-remote --heads origin | grep -E 'refs/heads/[0-9]+-<short-name>$'`
      - Local branches: `git branch | grep -E '^[* ]*[0-9]+-<short-name>$'`
      - Specs directories: Check for directories matching `specs/[0-9]+-<short-name>`

   c. Determine the next available number:
      - Extract all numbers from all three sources
      - Find the highest number N
      - Use N+1 for the new branch number

   d. Run the script `.specify/scripts/powershell/create-new-feature.ps1 -Json "$ARGUMENTS"` with the calculated number and short-name

   **IMPORTANT**:
   - Check all three sources to find the highest number
   - If no existing branches/directories found with this short-name, start with number 1
   - You must only run this script once per feature

3. Load `.specify/templates/terraform-spec-template.md` to understand required sections.

4. Follow this execution flow:

   1. Parse infrastructure description from Input
      If empty: ERROR "No infrastructure description provided"

   2. Extract key infrastructure concepts:
      - Cloud provider(s): AWS, GCP, Azure, Multi-cloud
      - Resource types: Compute, Storage, Networking, Database, Containers
      - Environment structure: dev, staging, prod
      - Security requirements: IAM, encryption, compliance
      - Networking: VPC, subnets, load balancers, DNS

   3. For unclear aspects:
      - Make informed guesses based on cloud best practices
      - Only mark with [NEEDS CLARIFICATION: specific question] if:
        - Choice significantly impacts cost or architecture
        - Security/compliance requirements are ambiguous
        - Multi-region or HA requirements unclear
      - **LIMIT: Maximum 3 [NEEDS CLARIFICATION] markers total**
      - Prioritize: security > cost > scalability > convenience

   4. Fill Infrastructure Components section
      Each component must map to Terraform resources

   5. Generate Resource Requirements
      Each requirement must be implementable in Terraform
      Use cloud provider defaults for unspecified details

   6. Define Success Criteria
      Create measurable, verifiable infrastructure outcomes
      Include both functional (connectivity, availability) and non-functional (cost, performance)

   7. Identify State Management Strategy
      - Backend type (S3, GCS, Azure Blob, Terraform Cloud)
      - State locking mechanism
      - Environment isolation approach

   8. Return: SUCCESS (spec ready for planning)

5. Write the specification to SPEC_FILE using the terraform template structure.

6. **Specification Quality Validation**: After writing the initial spec, validate against IaC quality criteria:

   a. **Create Spec Quality Checklist**: Generate at `FEATURE_DIR/checklists/requirements.md`:

      ```markdown
      # Infrastructure Specification Checklist: [INFRASTRUCTURE NAME]

      **Purpose**: Validate IaC specification before Terraform implementation
      **Created**: [DATE]
      **Feature**: [Link to spec.md]

      ## Infrastructure Quality

      - [ ] Cloud provider clearly identified
      - [ ] All resources map to Terraform resource types
      - [ ] Environment strategy defined (dev/staging/prod)
      - [ ] State management approach specified

      ## Security & Compliance

      - [ ] IAM/RBAC requirements defined
      - [ ] Encryption requirements specified (at-rest, in-transit)
      - [ ] Network security (security groups, NACLs) outlined
      - [ ] Compliance frameworks identified if applicable

      ## Networking

      - [ ] VPC/Network architecture defined
      - [ ] Subnet strategy (public/private) specified
      - [ ] Connectivity requirements clear (VPN, peering, internet)
      - [ ] DNS/domain requirements identified

      ## Operational Readiness

      - [ ] Monitoring and alerting requirements defined
      - [ ] Backup and disaster recovery specified
      - [ ] Scaling requirements (manual/auto) identified
      - [ ] Cost estimation approach included

      ## Module Structure

      - [ ] Module boundaries identified
      - [ ] Reusability requirements specified
      - [ ] Input/output variables outlined
      - [ ] Provider requirements documented

      ## Notes

      - Items marked incomplete require spec updates before `/terraform.plan`
      ```

   b. **Run Validation Check**: Review spec against each checklist item

   c. **Handle Validation Results**:
      - If all items pass: Mark checklist complete and proceed
      - If items fail: Update spec and re-validate (max 3 iterations)
      - If [NEEDS CLARIFICATION] markers remain: Present options to user (max 3)

7. Report completion with branch name, spec file path, checklist results, and readiness for next phase.

## Cloud Provider Guidelines

### AWS Resources (Common)
- Compute: EC2, ECS, EKS, Lambda, Fargate
- Storage: S3, EBS, EFS, FSx
- Database: RDS, DynamoDB, ElastiCache, Aurora
- Networking: VPC, ALB/NLB, Route53, CloudFront, API Gateway
- Security: IAM, KMS, Secrets Manager, WAF, Security Groups

### GCP Resources (Common)
- Compute: GCE, GKE, Cloud Run, Cloud Functions
- Storage: GCS, Persistent Disk, Filestore
- Database: Cloud SQL, Firestore, Memorystore, Spanner
- Networking: VPC, Cloud Load Balancing, Cloud DNS, Cloud CDN
- Security: IAM, KMS, Secret Manager, Cloud Armor

### Azure Resources (Common)
- Compute: VMs, AKS, Container Instances, Functions
- Storage: Blob Storage, Managed Disks, Files
- Database: Azure SQL, CosmosDB, Cache for Redis
- Networking: VNet, Load Balancer, Application Gateway, DNS
- Security: RBAC, Key Vault, NSGs, Azure Firewall

## Terraform Best Practices to Consider

1. **State Management**: Remote backend with locking
2. **Module Structure**: DRY principles, reusable modules
3. **Environment Separation**: Workspaces or directory structure
4. **Variable Management**: tfvars files, environment-specific configs
5. **Secret Handling**: Never commit secrets, use vault/secret managers
6. **Tagging Strategy**: Consistent resource tagging for cost/ownership
7. **Version Pinning**: Provider and module version constraints

## Success Criteria Guidelines

Success criteria for infrastructure must be:

1. **Measurable**: Specific metrics (uptime, latency, cost)
2. **Verifiable**: Can be tested with infrastructure tests
3. **Operational**: Focus on reliability and maintainability

**Good examples**:
- "VPC allows connectivity between all private subnets"
- "Database RDS instance achieves 99.9% availability"
- "Monthly infrastructure cost stays under $5000"
- "Deployment completes in under 15 minutes"

**Bad examples** (too vague):
- "Infrastructure is fast"
- "System is secure"
- "Resources are properly configured"
