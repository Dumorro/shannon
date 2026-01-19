# Infrastructure Specification: [INFRASTRUCTURE NAME]

**Feature Branch**: `[###-infra-name]`
**Created**: [DATE]
**Status**: Draft
**Input**: User description: "$ARGUMENTS"

## Overview

**Cloud Provider(s)**: [AWS | GCP | Azure | Multi-cloud]
**Primary Region**: [e.g., us-east-1, europe-west1, eastus]
**Environment Strategy**: [Single | Dev/Staging/Prod | Custom]
**Estimated Monthly Cost**: [Range or TBD]

### Purpose

[Brief description of what this infrastructure supports - the business/technical need]

### Scope

**In Scope**:
- [Resource/capability 1]
- [Resource/capability 2]

**Out of Scope**:
- [Explicitly excluded items]

---

## Infrastructure Components *(mandatory)*

<!--
  IMPORTANT: Components should be PRIORITIZED by deployment order and dependencies.
  Each component should map to one or more Terraform resources.
  Think in terms of modules and logical groupings.
-->

### Component 1 - Networking Foundation (Priority: P1)

[Describe the networking infrastructure]

**Why this priority**: Core infrastructure that other components depend on

**Terraform Resources**:
- `aws_vpc` / `google_compute_network` / `azurerm_virtual_network`
- Subnets (public/private)
- Route tables
- Internet Gateway / NAT Gateway

**Configuration Requirements**:
- CIDR block: [e.g., 10.0.0.0/16]
- Availability Zones: [e.g., 2-3 AZs for HA]
- Subnet strategy: [Public/Private separation]

**Dependencies**: None (foundation)

---

### Component 2 - Security Layer (Priority: P1)

[Describe security infrastructure]

**Why this priority**: Required before deploying any workloads

**Terraform Resources**:
- Security Groups / Firewall Rules
- IAM Roles and Policies
- KMS Keys (if encryption required)

**Configuration Requirements**:
- Ingress/Egress rules
- IAM principle of least privilege
- Encryption keys for sensitive data

**Dependencies**: Networking

---

### Component 3 - [Compute/Database/Storage] (Priority: P2)

[Describe the component]

**Why this priority**: [Explain value and dependencies]

**Terraform Resources**:
- [List specific Terraform resources]

**Configuration Requirements**:
- [Specific configurations]

**Dependencies**: [List dependencies]

---

### Component N - [Name] (Priority: PN)

[Continue pattern for additional components]

---

## State Management *(mandatory)*

### Backend Configuration

**Backend Type**: [S3 | GCS | Azure Blob | Terraform Cloud | Other]
**State Bucket/Container**: [Name pattern, e.g., `{project}-terraform-state`]
**State Locking**: [DynamoDB | GCS | Azure Blob Lease | Terraform Cloud]
**State File Structure**:
```
[state-bucket]/
├── [env]/
│   ├── networking/terraform.tfstate
│   ├── security/terraform.tfstate
│   └── compute/terraform.tfstate
```

### Environment Isolation

**Strategy**: [Workspaces | Directory Structure | Separate State Files]

| Environment | State Path | Purpose |
|-------------|------------|---------|
| dev | `dev/terraform.tfstate` | Development and testing |
| staging | `staging/terraform.tfstate` | Pre-production validation |
| prod | `prod/terraform.tfstate` | Production workloads |

---

## Module Structure *(mandatory)*

### Proposed Modules

```text
terraform/
├── modules/
│   ├── networking/          # VPC, subnets, routing
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── security/            # IAM, security groups
│   ├── compute/             # EC2, ECS, GKE, etc.
│   ├── database/            # RDS, Cloud SQL, etc.
│   └── monitoring/          # CloudWatch, Stackdriver
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf
│   ├── staging/
│   └── prod/
├── global/                   # Shared resources (IAM, DNS)
└── README.md
```

### Module Inputs/Outputs

**Networking Module**:
- Inputs: `cidr_block`, `environment`, `availability_zones`
- Outputs: `vpc_id`, `public_subnet_ids`, `private_subnet_ids`

**Security Module**:
- Inputs: `vpc_id`, `allowed_cidr_blocks`, `environment`
- Outputs: `security_group_ids`, `iam_role_arns`

[Continue for each module]

---

## Security Requirements *(mandatory)*

### Identity & Access Management

- [ ] IAM roles follow least privilege principle
- [ ] Service accounts have specific, limited permissions
- [ ] No hardcoded credentials in Terraform code
- [ ] Sensitive variables marked as `sensitive = true`

### Encryption

| Resource Type | At-Rest Encryption | In-Transit Encryption | Key Management |
|---------------|-------------------|----------------------|----------------|
| Storage | [Yes/No] | [Yes/No] | [KMS/Managed] |
| Database | [Yes/No] | [Yes/No] | [KMS/Managed] |
| Secrets | [Yes/No] | [Yes/No] | [Vault/SM] |

### Network Security

- **Ingress Rules**: [Define allowed inbound traffic]
- **Egress Rules**: [Define allowed outbound traffic]
- **Private Resources**: [Resources that should not have public IPs]
- **Bastion/Jump Host**: [Required/Not Required]

### Compliance (if applicable)

- [ ] [SOC2 / HIPAA / PCI-DSS / GDPR / Other]
- [ ] Audit logging enabled
- [ ] Resource tagging for compliance tracking

---

## Networking Requirements *(mandatory)*

### Network Architecture

```
[Diagram or description of network topology]

Example:
┌─────────────────────────────────────────────────────────┐
│                        VPC (10.0.0.0/16)                │
│  ┌─────────────────┐         ┌─────────────────┐        │
│  │  Public Subnet  │         │  Public Subnet  │        │
│  │  10.0.1.0/24    │         │  10.0.2.0/24    │        │
│  │  (AZ-a)         │         │  (AZ-b)         │        │
│  └────────┬────────┘         └────────┬────────┘        │
│           │          ALB              │                 │
│  ┌────────┴────────┐         ┌────────┴────────┐        │
│  │ Private Subnet  │         │ Private Subnet  │        │
│  │  10.0.10.0/24   │         │  10.0.20.0/24   │        │
│  │  (AZ-a)         │         │  (AZ-b)         │        │
│  └─────────────────┘         └─────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### CIDR Allocation

| Subnet Type | CIDR Block | AZ | Purpose |
|-------------|------------|-----|---------|
| Public A | 10.0.1.0/24 | a | Load balancers, NAT |
| Public B | 10.0.2.0/24 | b | Load balancers, NAT |
| Private A | 10.0.10.0/24 | a | Application workloads |
| Private B | 10.0.20.0/24 | b | Application workloads |
| Database A | 10.0.100.0/24 | a | Database instances |
| Database B | 10.0.200.0/24 | b | Database instances |

### Connectivity

- [ ] Internet access via NAT Gateway for private subnets
- [ ] VPN connectivity to on-premises: [Yes/No]
- [ ] VPC Peering with other VPCs: [Yes/No]
- [ ] Transit Gateway: [Yes/No]
- [ ] PrivateLink/Service Endpoints: [List services]

---

## Operational Requirements *(mandatory)*

### Monitoring & Alerting

**Metrics to Monitor**:
- CPU/Memory utilization
- Network throughput
- Database connections
- Error rates

**Alerting Thresholds**:
| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| CPU | >70% | >90% | Scale up |
| Memory | >80% | >95% | Investigate |
| Disk | >75% | >90% | Expand storage |

### Backup & Disaster Recovery

| Resource | Backup Frequency | Retention | Recovery Time |
|----------|-----------------|-----------|---------------|
| Database | Daily | 30 days | < 1 hour |
| Storage | [Versioning] | [Days] | [Time] |

**DR Strategy**: [Active-Active | Active-Passive | Pilot Light | Backup-Restore]

### Scaling

| Resource | Scaling Type | Min | Max | Trigger |
|----------|-------------|-----|-----|---------|
| Compute | Auto | 2 | 10 | CPU > 70% |
| Database | Manual | - | - | Review monthly |

---

## Tagging Strategy *(mandatory)*

All resources MUST have the following tags:

| Tag Key | Description | Example Value |
|---------|-------------|---------------|
| Environment | Deployment environment | dev, staging, prod |
| Project | Project identifier | shannon |
| Owner | Team or individual | platform-team |
| ManagedBy | IaC tool | terraform |
| CostCenter | Billing allocation | engineering |
| CreatedDate | Resource creation date | 2026-01-19 |

---

## Success Criteria *(mandatory)*

### Functional Criteria

- **SC-001**: All VPC subnets can communicate according to defined routing
- **SC-002**: Private resources are not accessible from public internet
- **SC-003**: Database is accessible only from application subnets
- **SC-004**: [Additional functional criteria]

### Operational Criteria

- **SC-005**: `terraform plan` completes without errors
- **SC-006**: `terraform apply` completes in under [X] minutes
- **SC-007**: All resources tagged according to tagging strategy
- **SC-008**: State file stored securely with locking enabled

### Performance Criteria

- **SC-009**: Application latency under [X]ms from load balancer
- **SC-010**: Database can handle [X] concurrent connections
- **SC-011**: [Additional performance criteria]

### Cost Criteria

- **SC-012**: Monthly infrastructure cost under $[X]
- **SC-013**: No unused/orphaned resources after deployment
- **SC-014**: Reserved instances used for predictable workloads

---

## Assumptions

<!--
  Document reasonable defaults and assumptions made during specification.
  These can be validated during the planning phase.
-->

- [Assumption 1: e.g., "Single region deployment sufficient for latency requirements"]
- [Assumption 2: e.g., "Managed database services preferred over self-managed"]
- [Assumption 3: e.g., "Development environment does not require HA"]

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Cost overrun | Medium | High | Set billing alerts, use cost estimation |
| Security misconfiguration | Low | Critical | Use terraform-compliance, checkov |
| State file corruption | Low | High | Enable versioning, regular backups |

---

## Dependencies

### External Dependencies

- [Cloud provider account with appropriate permissions]
- [DNS zone if custom domain required]
- [VPN/Direct Connect if hybrid connectivity]

### Internal Dependencies

- [Application code repository]
- [CI/CD pipeline for infrastructure]
- [Secrets management solution]

---

## Next Steps

1. Run `/terraform.plan` to generate technical implementation plan
2. Run `/speckit.tasks` to generate implementation tasks
3. Review and approve infrastructure design
4. Implement Terraform modules following the plan
