# Implementation Plan: Billing & Subscriptions

**Branch**: `010-billing` | **Date**: 2026-01-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-billing/spec.md`

## Summary

Implement Stripe-based billing and subscription management for Shannon SaaS, enabling monetization through tiered plans (Free, Pro, Enterprise). The system uses Stripe Checkout for PCI-DSS compliant payment collection, Customer Portal for self-service subscription management, and metered billing for LLM token usage tracking.

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js 16, Node.js 20+)
**Primary Dependencies**: stripe ^14.0.0, @prisma/client, next
**Storage**: PostgreSQL (via Prisma ORM, database: `ghostshell`)
**Testing**: Vitest (70% coverage target for GhostShell)
**Target Platform**: Vercel/AWS deployment (web application)
**Project Type**: Web application (monorepo: ghostshell + shannon)
**Performance Goals**: <2s billing dashboard load, <100ms limit checks
**Constraints**: PCI-DSS compliance (all payment data via Stripe), webhook processing <30s
**Scale/Scope**: Initial target 1000 organizations, 10k scans/month

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Security-First | PASS | PCI-DSS via Stripe hosted checkout; no payment data on our servers; webhook signature verification |
| II. AI-Native | PASS | Token usage tracking at tenant level per constitution requirement |
| III. Multi-Tenant Isolation | PASS | All billing data scoped by organizationId; Stripe customer per org |
| IV. Temporal-First | N/A | Billing is synchronous; scan duration enforcement integrates with existing workflows |
| V. Progressive Delivery | PASS | 6 prioritized user stories (P1-P3); MVP = US1+US2 (checkout + management) |
| VI. Observability | PASS | BillingEvent audit trail; structured logging; webhook event logging |
| VII. Simplicity | PASS | Stripe handles complexity; minimal custom code; managed service approach |

**Quality Gates (GhostShell)**:
- Tests REQUIRED for billing actions, webhook handlers, and UI components
- 70% coverage target applies to new billing code

## Project Structure

### Documentation (this feature)

```text
specs/010-billing/
├── plan.md              # This file
├── research.md          # Phase 0 output - completed
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── billing-api.yaml # OpenAPI spec
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
ghostshell/
├── app/
│   ├── (dashboard)/org/[orgId]/billing/
│   │   ├── page.tsx              # Billing dashboard
│   │   └── components/
│   │       ├── plan-comparison.tsx
│   │       ├── usage-indicator.tsx
│   │       └── subscription-status.tsx
│   └── api/
│       ├── billing/
│       │   ├── checkout/route.ts  # Create checkout session
│       │   └── portal/route.ts    # Create portal session
│       └── webhooks/
│           └── stripe/route.ts    # Webhook handler
├── lib/
│   ├── billing/
│   │   ├── stripe-client.ts       # Stripe SDK wrapper
│   │   ├── usage-tracker.ts       # Token usage tracking
│   │   ├── plan-limits.ts         # Plan configuration
│   │   └── webhook-handlers.ts    # Webhook event processors
│   └── actions/
│       └── billing.ts             # Server actions
├── prisma/
│   └── migrations/
│       └── XXXXXXX_add_billing/   # Schema migration
└── __tests__/
    ├── unit/
    │   ├── billing/
    │   │   ├── stripe-client.test.ts
    │   │   ├── usage-tracker.test.ts
    │   │   └── plan-limits.test.ts
    └── integration/
        └── billing-webhook.spec.ts
```

**Structure Decision**: Billing code lives in GhostShell package following existing patterns. New `lib/billing/` directory for billing-specific utilities. API routes follow Next.js App Router conventions.

## Complexity Tracking

No constitution violations requiring justification. Design follows simplicity principle:
- Stripe handles payment complexity
- Single plan configuration in code
- Minimal new models (BillingEvent, UsageRecord only)
