# Tasks: Billing & Subscriptions

**Input**: Design documents from `/specs/010-billing/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/billing-api.yaml

**Tests**: REQUIRED per constitution (70% coverage target for GhostShell)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1-US6) or blank for setup/foundational

## Path Conventions

Based on plan.md structure:
- **Source**: `ghostshell/lib/billing/`, `ghostshell/app/api/`
- **UI**: `ghostshell/app/(dashboard)/org/[orgId]/billing/`
- **Tests**: `ghostshell/__tests__/unit/billing/`, `ghostshell/__tests__/integration/`
- **Schema**: `ghostshell/prisma/schema.prisma`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and configure environment

- [x] T001 Install stripe package: `npm install stripe` in ghostshell/package.json
- [x] T002 [P] Add Stripe environment variables to ghostshell/.env.example (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_ANNUAL)
- [x] T003 [P] Create ghostshell/lib/billing/ directory structure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, core utilities, and shared infrastructure

**CRITICAL**: No user story work can begin until this phase is complete

### Database Migration

- [x] T004 Add billing fields to Organization model in ghostshell/prisma/schema.prisma (stripeCustomerId, stripeSubscriptionId, subscriptionStatus, currentPeriodEnd, billingEmail)
- [x] T005 Create BillingEvent model in ghostshell/prisma/schema.prisma per data-model.md
- [x] T006 Create UsageRecord model in ghostshell/prisma/schema.prisma per data-model.md
- [x] T007 Create PlanLimits model in ghostshell/prisma/schema.prisma per data-model.md
- [x] T008 Run Prisma migration: `npx prisma migrate dev --name add_billing`
- [x] T009 Create seed script for PlanLimits data in ghostshell/prisma/seed.ts (free, pro, enterprise)

### Core Utilities

- [x] T010 [P] Create Stripe client wrapper in ghostshell/lib/billing/stripe-client.ts
- [x] T011 [P] Create plan limits configuration in ghostshell/lib/billing/plan-limits.ts (PLAN_CONFIG with free/pro/enterprise limits)
- [x] T012 [P] Create billing types in ghostshell/lib/billing/types.ts (PlanType, SubscriptionStatus, BillingEventType)

### Tests for Foundational

- [x] T013 [P] Unit test for plan-limits.ts in ghostshell/__tests__/unit/billing/plan-limits.test.ts

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 3: User Story 1 - Plan Selection & Checkout (Priority: P1) MVP

**Goal**: Enable users to upgrade from Free to paid plans via Stripe Checkout

**Independent Test**: Navigate to billing, select Pro plan, complete checkout with test card 4242424242424242, verify plan upgraded

### Tests for User Story 1

- [x] T014 [P] [US1] Unit test for checkout action in ghostshell/__tests__/unit/billing/checkout.test.ts
- [x] T015 [P] [US1] Unit test for stripe-client.ts checkout functions in ghostshell/__tests__/unit/billing/stripe-client.test.ts

### Implementation for User Story 1

- [x] T016 [US1] Implement createCheckoutSession in ghostshell/lib/billing/stripe-client.ts
- [x] T017 [US1] Implement getOrCreateStripeCustomer in ghostshell/lib/billing/stripe-client.ts
- [x] T018 [US1] Create checkout server action in ghostshell/lib/actions/billing.ts (createCheckoutSession)
- [x] T019 [US1] Create POST /api/billing/checkout route in ghostshell/app/api/billing/checkout/route.ts
- [x] T020 [P] [US1] Create PlanComparison component in ghostshell/app/(dashboard)/org/[orgId]/billing/components/plan-comparison.tsx
- [x] T021 [P] [US1] Create UpgradeButton component in ghostshell/app/(dashboard)/org/[orgId]/billing/components/upgrade-button.tsx
- [x] T022 [US1] Create billing dashboard page in ghostshell/app/(dashboard)/org/[orgId]/billing/page.tsx
- [x] T023 [US1] Handle checkout success/cancel query params in billing page
- [x] T024 [US1] Add "Contact Sales" button for Enterprise tier in plan-comparison.tsx

**Checkpoint**: Users can view plans and complete checkout - MVP functional

---

## Phase 4: User Story 2 - Subscription Management (Priority: P1)

**Goal**: Enable paying customers to manage subscription via Stripe Customer Portal

**Independent Test**: Click "Manage Subscription", access portal, view invoices, update payment method

### Tests for User Story 2

- [x] T025 [P] [US2] Unit test for portal action in ghostshell/__tests__/unit/billing/portal.test.ts

### Implementation for User Story 2

- [x] T026 [US2] Implement createPortalSession in ghostshell/lib/billing/stripe-client.ts
- [x] T027 [US2] Create portal server action in ghostshell/lib/actions/billing.ts (createPortalSession)
- [x] T028 [US2] Create POST /api/billing/portal route in ghostshell/app/api/billing/portal/route.ts
- [x] T029 [P] [US2] Create SubscriptionStatus component in ghostshell/app/(dashboard)/org/[orgId]/billing/components/subscription-status.tsx
- [x] T030 [US2] Add "Manage Subscription" button to billing page (only for paying customers)
- [x] T031 [US2] Display cancellation notice when subscription marked for cancellation

**Checkpoint**: Paying customers can self-serve subscription management

---

## Phase 5: User Story 5 - Billing Webhooks & Sync (Priority: P2)

**Goal**: Keep application in sync with Stripe subscription state via webhooks

**Independent Test**: Use Stripe CLI to trigger webhook events, verify organization plan updates

**Note**: Moved before US3/US4 as webhooks are infrastructure for other stories

### Tests for User Story 5

- [x] T032 [P] [US5] Integration test for webhook handler in ghostshell/__tests__/integration/billing-webhook.test.ts
- [x] T033 [P] [US5] Unit test for webhook handlers in ghostshell/__tests__/unit/billing/webhook-handlers.test.ts

### Implementation for User Story 5

- [x] T034 [US5] Create webhook event handlers in ghostshell/lib/billing/webhook-handlers.ts (handleCheckoutCompleted, handlePaymentSucceeded, handlePaymentFailed, handleSubscriptionUpdated, handleSubscriptionDeleted)
- [x] T035 [US5] Implement idempotent event processing using stripeEventId in webhook-handlers.ts
- [x] T036 [US5] Create POST /api/webhooks/stripe route in ghostshell/app/api/webhooks/stripe/route.ts
- [x] T037 [US5] Implement webhook signature verification in route.ts
- [x] T038 [US5] Create BillingEvent audit logging in webhook-handlers.ts
- [x] T039 [US5] Add payment failed banner component in ghostshell/components/payment-failed-banner.tsx
- [x] T040 [US5] Integrate payment failed banner in dashboard layout

**Checkpoint**: Webhooks sync subscription state reliably

---

## Phase 6: User Story 3 - Usage-Based Billing for AI (Priority: P2)

**Goal**: Track LLM token usage per organization with overage billing

**Independent Test**: Run scan, view usage in billing dashboard, verify token count increases

### Tests for User Story 3

- [x] T041 [P] [US3] Unit test for usage-tracker.ts in ghostshell/__tests__/unit/billing/usage-tracker.test.ts

### Implementation for User Story 3

- [x] T042 [US3] Create usage tracking service in ghostshell/lib/billing/usage-tracker.ts (recordTokenUsage, getCurrentPeriodUsage, checkUsageAllowance)
- [x] T043 [US3] Implement getOrCreateUsageRecord in usage-tracker.ts
- [x] T044 [US3] Create GET /api/org/[orgId]/usage route in ghostshell/app/api/org/[orgId]/usage/route.ts
- [x] T045 [P] [US3] Create UsageIndicator component in ghostshell/app/(dashboard)/org/[orgId]/billing/components/usage-indicator.tsx
- [x] T046 [US3] Add usage display to billing dashboard page
- [x] T047 [US3] Implement 80% threshold notification in usage-tracker.ts (sendUsageAlert)
- [x] T048 [US3] Create usage alert email template in ghostshell/lib/email/templates/usage-alert.tsx
- [x] T049 [US3] Implement reportOverageToStripe for metered billing in usage-tracker.ts

**Checkpoint**: Token usage tracked and displayed with notifications

---

## Phase 7: User Story 4 - Plan Enforcement & Resource Limits (Priority: P2)

**Goal**: Enforce plan-specific limits on concurrent scans, team members, scan duration

**Independent Test**: As Free tier, attempt second concurrent scan - verify blocked with upgrade prompt

### Tests for User Story 4

- [x] T050 [P] [US4] Unit test for limit checks in ghostshell/__tests__/unit/billing/plan-enforcement.test.ts

### Implementation for User Story 4

- [x] T051 [US4] Create checkConcurrentScanLimit in ghostshell/lib/billing/plan-limits.ts
- [x] T052 [US4] Create checkTeamMemberLimit in ghostshell/lib/billing/plan-limits.ts
- [x] T053 [US4] Create checkScanDurationLimit in ghostshell/lib/billing/plan-limits.ts
- [x] T054 [US4] Create hasFeatureAccess in ghostshell/lib/billing/plan-limits.ts
- [x] T055 [US4] Update ghostshell/lib/scan-queue.ts to use plan-based concurrent limits
- [x] T056 [US4] Update ghostshell/lib/actions/invitations.ts to use plan-based team limits
- [x] T057 [P] [US4] Create UpgradePrompt component in ghostshell/components/upgrade-prompt.tsx
- [x] T058 [US4] Add limit displays to billing dashboard (usage vs limits)
- [x] T059 [US4] Integrate upgrade prompts in scan creation flow
- [x] T060 [US4] Integrate upgrade prompts in team invitation flow

**Checkpoint**: Plan limits enforced with clear upgrade messaging

---

## Phase 8: User Story 6 - Annual Billing & Discounts (Priority: P3)

**Goal**: Offer annual billing option with 2-months-free discount

**Independent Test**: Toggle annual billing, verify prices show discount, complete annual checkout

### Tests for User Story 6

- [x] T061 [P] [US6] Unit test for annual pricing calculations in ghostshell/__tests__/unit/billing/annual-pricing.test.ts

### Implementation for User Story 6

- [x] T062 [US6] Add annual price support to plan-limits.ts (getAnnualPrice, getAnnualSavings)
- [x] T063 [US6] Update createCheckoutSession to support annual priceId in stripe-client.ts
- [x] T064 [US6] Add billing interval toggle to plan-comparison.tsx (Monthly/Annual)
- [x] T065 [US6] Display annual savings in plan-comparison.tsx ("Save $198/year")
- [x] T066 [US6] Add renewal date display for annual subscribers in subscription-status.tsx
- [x] T067 [US6] Create renewal reminder email template in ghostshell/lib/email/templates/renewal-reminder.tsx

**Checkpoint**: Annual billing available with discount messaging

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements across all user stories

- [x] T068 [P] Create GET /api/org/[orgId]/billing route in ghostshell/app/api/org/[orgId]/billing/route.ts (combined billing info)
- [x] T069 [P] Add billing access control middleware (Owner/Admin = manage, Member = view usage, Viewer = no access)
- [x] T070 [P] Add error handling for Stripe service unavailability in checkout/portal routes
- [x] T071 [P] Add structured logging for all billing operations
- [x] T072 Run all billing tests and verify 70% coverage target
- [ ] T073 Manual validation using quickstart.md scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (BLOCKS all user stories)
    ↓
┌───────────────────────────────────────────────┐
│ User Stories can proceed in priority order    │
│ or in parallel if team capacity allows        │
└───────────────────────────────────────────────┘
    ↓
Phase 3: US1 - Checkout (P1) ← MVP
    ↓
Phase 4: US2 - Subscription Management (P1)
    ↓
Phase 5: US5 - Webhooks (P2) ← Infrastructure for US3/US4
    ↓
Phase 6: US3 - Usage Tracking (P2)
    ↓
Phase 7: US4 - Plan Enforcement (P2)
    ↓
Phase 8: US6 - Annual Billing (P3)
    ↓
Phase 9: Polish
```

### User Story Dependencies

| Story | Priority | Can Start After | Dependencies |
|-------|----------|-----------------|--------------|
| US1 | P1 | Phase 2 | None |
| US2 | P1 | Phase 2 | None |
| US5 | P2 | US1 (needs checkout to test) | Stripe customer exists |
| US3 | P2 | US5 (uses webhooks) | Webhook infrastructure |
| US4 | P2 | Phase 2 | None (can parallel with US3) |
| US6 | P3 | US1, US2 | Checkout flow exists |

### Within Each User Story

1. Tests written FIRST (TDD)
2. Core logic before API routes
3. API routes before UI components
4. Integration last

---

## Parallel Opportunities

### Phase 2 Parallel Tasks

```bash
# Database models can be created in parallel:
T005, T006, T007  # BillingEvent, UsageRecord, PlanLimits models

# Core utilities can be created in parallel:
T010, T011, T012  # stripe-client, plan-limits, types
```

### US1 Parallel Tasks

```bash
# Tests in parallel:
T014, T015  # checkout.test.ts, stripe-client.test.ts

# UI components in parallel:
T020, T021  # plan-comparison.tsx, upgrade-button.tsx
```

### Cross-Story Parallelization

With 2+ developers after Phase 2:
- Developer A: US1 → US2 → US6
- Developer B: US5 → US3 → US4

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T013)
3. Complete Phase 3: US1 Checkout (T014-T024)
4. **STOP AND VALIDATE**: Test checkout flow end-to-end
5. Deploy - users can now upgrade plans!

### Incremental Delivery

| Milestone | Stories | Value Delivered |
|-----------|---------|-----------------|
| MVP | US1 | Users can upgrade to paid plans |
| v1.1 | US1 + US2 | Self-service subscription management |
| v1.2 | + US5 | Reliable billing state sync |
| v1.3 | + US3, US4 | Usage tracking and limit enforcement |
| v1.4 | + US6 | Annual billing option |

---

## Task Summary

| Phase | Story | Task Count | Parallel |
|-------|-------|------------|----------|
| Setup | - | 3 | 2 |
| Foundational | - | 10 | 4 |
| US1 Checkout | P1 | 11 | 4 |
| US2 Management | P1 | 7 | 2 |
| US5 Webhooks | P2 | 9 | 2 |
| US3 Usage | P2 | 9 | 2 |
| US4 Enforcement | P2 | 11 | 2 |
| US6 Annual | P3 | 7 | 1 |
| Polish | - | 6 | 4 |
| **Total** | | **73** | **23** |

---

## Notes

- All file paths relative to repository root
- [P] tasks have no dependencies on incomplete tasks in same phase
- Tests use Vitest per project configuration
- Stripe test mode for all development (test card: 4242424242424242)
- Webhook testing via Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
