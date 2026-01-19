# Research: Billing & Subscriptions

**Feature**: 010-billing
**Date**: 2026-01-19
**Status**: Complete

## Executive Summary

This research document consolidates findings for implementing Stripe-based billing and subscription management for Shannon SaaS. All technical unknowns have been resolved with clear decisions and rationale.

---

## 1. Stripe Integration Architecture

### Decision: Use Stripe Checkout + Customer Portal

**Rationale**:
- PCI-DSS compliance achieved by delegating all payment data handling to Stripe
- Minimal code surface area reduces security risk
- Stripe handles payment method updates, invoice downloads, and cancellations
- Proven pattern used by major SaaS applications

**Alternatives Considered**:
- Stripe Elements (embedded forms): Rejected - more code, same PCI scope, higher maintenance
- Self-hosted payment forms: Rejected - PCI compliance burden unacceptable
- PayPal/other providers: Rejected - Stripe is industry standard for SaaS

### Implementation Pattern

```
User clicks "Upgrade"
  → Server creates Stripe Checkout Session
  → Redirect to Stripe-hosted checkout page
  → User completes payment on Stripe
  → Redirect back with session_id
  → Webhook confirms payment
  → Organization plan updated
```

### Key Stripe Products

| Product | Use Case |
|---------|----------|
| Checkout | Payment collection for new subscriptions |
| Customer Portal | Self-service subscription management |
| Billing | Metered usage billing for token overages |
| Webhooks | Event-driven subscription state sync |

---

## 2. Webhook Handling Strategy

### Decision: Event ID-Based Idempotency

**Rationale**:
- Stripe guarantees at-least-once delivery (duplicates possible)
- Using `stripeEventId` as unique constraint prevents double-processing
- Aligns with existing Clerk webhook pattern in codebase

### Critical Webhooks to Handle

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Upgrade organization plan |
| `invoice.payment_succeeded` | Confirm active subscription |
| `invoice.payment_failed` | Mark past_due, notify billing admin |
| `customer.subscription.updated` | Sync plan changes |
| `customer.subscription.deleted` | Downgrade to Free tier |

### Signature Verification

All webhooks MUST verify signature using `STRIPE_WEBHOOK_SECRET`:
```typescript
const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
```

Reject requests with invalid signatures and log security alert.

---

## 3. Usage-Based Billing (LLM Tokens)

### Decision: Hybrid Model (Included Allowance + Metered Overages)

**Rationale**:
- Aligns costs with value delivered
- Free tier has hard limits (prevents bill shock)
- Pro/Enterprise have included allowance with overage billing
- Matches industry patterns (Vercel, OpenAI, etc.)

### Token Tracking Architecture

```
Scan Completion
  → Claude SDK returns token counts
  → Record UsageEvent in database
  → Update MonthlySummary (denormalized)
  → If Pro/Enterprise: Report overages to Stripe Metering API
  → Check 80% threshold → Send alert email
```

### Plan Allowances

| Plan | Monthly Tokens | Overage Rate | Hard Limit |
|------|---------------|--------------|------------|
| Free | 50,000 | N/A | Yes (block scans) |
| Pro | 500,000 | $1/1M tokens | No |
| Enterprise | 5,000,000 | Custom | No |

---

## 4. Database Schema Design

### Decision: Extend Organization Model + New Tables

**Rationale**:
- Organization already has `plan` field
- Adding billing fields maintains single source of truth
- Separate audit tables (BillingEvent, UsageRecord) for compliance
- Denormalized counters for dashboard performance

### New Fields on Organization

```prisma
stripeCustomerId      String?   // Stripe customer lookup
stripeSubscriptionId  String?   // Active subscription
subscriptionStatus    String    // active, past_due, canceled
currentPeriodEnd      DateTime? // Billing cycle end
billingEmail          String?   // Optional override
```

### New Models

- **BillingEvent**: Audit trail for all billing lifecycle events
- **UsageRecord**: Per-period token consumption tracking
- **MonthlySummary**: Denormalized usage for fast dashboard queries

---

## 5. Plan Enforcement Strategy

### Decision: Centralized Plan Configuration in Code

**Rationale**:
- Version controlled and auditable
- No runtime database queries for limit checks
- Easy to test and validate
- Can be overridden per-org if needed (database fallback)

### Enforcement Points

| Limit | Enforcement Location |
|-------|---------------------|
| Concurrent scans | `checkConcurrentLimit()` before scan creation |
| Team members | `canAddTeamMember()` before invitation |
| Scan duration | Temporal workflow monitors elapsed time |
| Token usage | Check before scan start (Free tier) |

### Graceful Degradation

- Duration limit: Generate partial report with findings so far
- Token limit (Free): Block new scans, show upgrade prompt
- Team limit: Block invitation, show capacity indicator

---

## 6. Annual Billing Implementation

### Decision: Stripe Price Variants (Monthly + Annual)

**Rationale**:
- Stripe natively supports multiple prices per product
- Annual discount (2 months free = ~17% off) is industry standard
- Customer Portal allows switching intervals

### Price Structure

| Plan | Monthly | Annual | Savings |
|------|---------|--------|---------|
| Pro | $99/mo | $990/yr | $198 (17%) |
| Enterprise | Custom | Custom | Negotiated |

---

## 7. Security Considerations

### PCI-DSS Compliance Checklist

- [x] No credit card data ever touches our servers
- [x] Stripe Checkout handles tokenization
- [x] Customer Portal handles payment method updates
- [x] Webhook signatures verified before processing
- [x] HTTPS only for all Stripe communication
- [x] Minimal PII storage (email, customer ID only)

### Webhook Security

- Reject unsigned/invalid webhooks
- Log all webhook attempts (success and failure)
- Rate limit webhook endpoint
- Idempotent processing prevents replay attacks

---

## 8. Existing Codebase Integration

### Already Implemented

- `Organization.plan` field exists (free/pro/enterprise)
- Team member limits in `invitations.ts`
- Concurrent scan limits in `scan-queue.ts`
- Audit logging infrastructure in `AuditLog` model

### Patterns to Extend

- Clerk webhook handler pattern → Apply to Stripe webhooks
- `ScanResult.totalTokensUsed` → Feed into UsageRecord
- Soft delete pattern → Apply to subscription cancellation

---

## 9. Environment Variables Required

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_live_...      # Server-side API calls
STRIPE_WEBHOOK_SECRET=whsec_...    # Webhook signature verification

# Stripe Price IDs (create in Stripe Dashboard)
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_ANNUAL=price_...
```

---

## 10. Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Currency support? | USD only for MVP |
| Tax handling? | Deferred - Stripe Tax integration later |
| Refund process? | Manual via Stripe Dashboard |
| Trial periods? | No trials - Free tier serves as trial |
| Enterprise pricing? | Contact sales form, custom quotes |

---

## 11. Dependencies

### NPM Packages

```json
{
  "stripe": "^14.0.0"
}
```

### External Services

- **Stripe**: Payment processing, metered billing
- **Resend**: Billing notification emails (already integrated)

---

## 12. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Webhook failures | Stripe retries + dead letter queue monitoring |
| Plan drift from Stripe | Webhook sync + daily reconciliation job |
| Token tracking accuracy | Double-entry (ScanResult + UsageRecord) |
| Customer disputes | Audit trail in BillingEvent table |
