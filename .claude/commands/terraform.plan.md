---
description: Create Terraform implementation plan from infrastructure specification.
handoffs:
  - label: Generate Tasks
    agent: speckit.tasks
    prompt: Generate implementation tasks from the Terraform plan
  - label: Implement Infrastructure
    agent: speckit.implement
    prompt: Implement the Terraform infrastructure following the plan
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

This command creates a detailed Terraform implementation plan from an existing infrastructure specification.

### Execution Flow

1. **Locate Infrastructure Specification**

   a. Identify current feature branch: `git branch --show-current`

   b. Extract feature number and name from branch (e.g., `001-aws-vpc-networking`)

   c. Load specification from `specs/[###-feature-name]/spec.md`

   d. If spec not found: ERROR "No specification found. Run /terraform.specify first"

2. **Validate Specification Completeness**

   - Check for [NEEDS CLARIFICATION] markers
   - If found: ERROR "Specification has unresolved items. Run /speckit.clarify first"
   - Verify all mandatory sections are present

3. **Analyze Infrastructure Requirements**

   From the specification, extract:
   - Cloud provider(s) and target regions
   - Resource types and dependencies
   - Environment structure
   - Security and compliance requirements
   - State management approach
   - Module structure

4. **Generate Technical Plan**

   Create `specs/[###-feature-name]/plan.md` with:

   ```markdown
   # Terraform Implementation Plan: [INFRASTRUCTURE NAME]

   **Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

   ## Summary

   [Brief overview of infrastructure to be deployed]

   ## Technical Context

   **Cloud Provider**: [AWS/GCP/Azure]
   **Terraform Version**: >= 1.5.0
   **Provider Versions**: [Specific provider version constraints]
   **Backend**: [S3/GCS/Azure Blob with locking]
   **State Structure**: [Per-environment/Per-component]

   ## Provider Configuration

   ```hcl
   terraform {
     required_version = ">= 1.5.0"

     required_providers {
       [provider] = {
         source  = "[provider/source]"
         version = "~> [version]"
       }
     }

     backend "[type]" {
       [backend configuration]
     }
   }
   ```

   ## Module Architecture

   ### Module Dependency Graph

   ```
   [Visual representation of module dependencies]

   networking (foundation)
       │
       ├── security (depends: networking)
       │       │
       │       ├── compute (depends: networking, security)
       │       │
       │       └── database (depends: networking, security)
       │
       └── monitoring (depends: all)
   ```

   ### Module Specifications

   #### Module: networking

   **Purpose**: [Description]
   **Path**: `terraform/modules/networking/`

   **Resources**:
   | Resource | Type | Purpose |
   |----------|------|---------|
   | main_vpc | aws_vpc | Primary VPC |
   | public_subnets | aws_subnet | Public subnets |
   | ... | ... | ... |

   **Variables**:
   | Name | Type | Required | Description |
   |------|------|----------|-------------|
   | cidr_block | string | yes | VPC CIDR |
   | ... | ... | ... | ... |

   **Outputs**:
   | Name | Description |
   |------|-------------|
   | vpc_id | ID of created VPC |
   | ... | ... |

   [Repeat for each module]

   ## Environment Configuration

   ### Variable Files Structure

   ```
   environments/
   ├── dev/
   │   ├── terraform.tfvars    # Dev-specific values
   │   └── backend.tfvars      # Dev state backend
   ├── staging/
   │   ├── terraform.tfvars
   │   └── backend.tfvars
   └── prod/
       ├── terraform.tfvars
       └── backend.tfvars
   ```

   ### Environment Differences

   | Setting | Dev | Staging | Prod |
   |---------|-----|---------|------|
   | Instance size | t3.small | t3.medium | t3.large |
   | HA enabled | No | Yes | Yes |
   | Backup retention | 7 days | 14 days | 30 days |
   | ... | ... | ... | ... |

   ## Security Implementation

   ### IAM Strategy

   | Role | Purpose | Policies |
   |------|---------|----------|
   | [role-name] | [purpose] | [attached policies] |

   ### Network Security

   | Security Group | Ingress | Egress | Attached To |
   |----------------|---------|--------|-------------|
   | [sg-name] | [rules] | [rules] | [resources] |

   ### Secrets Management

   - [ ] Use [Secrets Manager/Vault/Parameter Store] for sensitive data
   - [ ] Never store secrets in terraform.tfvars
   - [ ] Use `sensitive = true` for sensitive outputs

   ## Deployment Strategy

   ### Prerequisites

   1. [Prerequisite 1: e.g., "AWS credentials configured"]
   2. [Prerequisite 2: e.g., "State bucket created"]
   3. [Prerequisite 3: e.g., "Required IAM permissions"]

   ### Deployment Order

   1. **Phase 1: Foundation**
      - Create state backend (manual or bootstrap script)
      - Deploy networking module
      - Deploy security module

   2. **Phase 2: Infrastructure**
      - Deploy compute resources
      - Deploy database resources
      - Configure load balancers

   3. **Phase 3: Operations**
      - Deploy monitoring
      - Configure alerting
      - Validate connectivity

   ### Rollback Strategy

   - Keep previous state versions (S3 versioning enabled)
   - Use `terraform plan -destroy` before actual destroy
   - Document manual intervention points

   ## Validation & Testing

   ### Pre-Deployment

   - [ ] `terraform fmt -check` passes
   - [ ] `terraform validate` passes
   - [ ] `tflint` passes (if configured)
   - [ ] `checkov` security scan passes

   ### Post-Deployment

   - [ ] All resources created successfully
   - [ ] Connectivity tests pass
   - [ ] Monitoring dashboards populated
   - [ ] Alerts configured and tested

   ## Cost Estimation

   | Resource | Quantity | Unit Cost | Monthly Cost |
   |----------|----------|-----------|--------------|
   | [resource] | [qty] | $[cost] | $[total] |
   | **Total** | | | **$[total]** |

   *Note: Estimates based on [region] pricing as of [date]*

   ## Risk Considerations

   | Risk | Mitigation |
   |------|------------|
   | [risk] | [mitigation] |

   ## Documentation Requirements

   - [ ] README.md for each module
   - [ ] Variable descriptions complete
   - [ ] Output descriptions complete
   - [ ] Example usage documented
   ```

5. **Generate Supporting Artifacts**

   a. **Research Document** (`specs/[###-feature-name]/research.md`):
      - Provider-specific best practices
      - Module design decisions
      - Alternative approaches considered

   b. **Data Model** (`specs/[###-feature-name]/data-model.md`):
      - Resource relationship diagram
      - State file structure
      - Output dependencies

6. **Validate Plan Against Specification**

   Ensure:
   - All components from spec have corresponding modules
   - Security requirements are addressed
   - State management aligns with spec
   - Success criteria are achievable

7. **Report Completion**

   Output:
   - Plan file location
   - Module count and structure
   - Identified risks
   - Recommended next step: `/speckit.tasks`

## Terraform-Specific Considerations

### Module Design Principles

1. **Single Responsibility**: Each module handles one logical component
2. **Minimal Dependencies**: Reduce inter-module coupling
3. **Sensible Defaults**: Provide secure defaults for all variables
4. **Output Everything**: Export all IDs and ARNs that might be needed

### State Management Best Practices

1. **Remote State**: Always use remote backend with locking
2. **State Isolation**: Separate state per environment
3. **State Security**: Encrypt state at rest
4. **State Backup**: Enable versioning on state bucket

### Variable Naming Conventions

```hcl
# Boolean flags: use is_ or enable_ prefix
variable "enable_dns_hostnames" {}
variable "is_public" {}

# Lists: use plural names
variable "subnet_ids" {}
variable "security_group_ids" {}

# Maps: use _map suffix
variable "tags_map" {}

# Secrets: always mark sensitive
variable "database_password" {
  sensitive = true
}
```

### Output Naming Conventions

```hcl
# Resource IDs: [resource]_id
output "vpc_id" {}

# ARNs: [resource]_arn
output "role_arn" {}

# Lists: [resource]_ids (plural)
output "subnet_ids" {}
```
