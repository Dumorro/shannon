# Feature Specification: Billing & Subscriptions

**Feature Branch**: `010-billing`
**Created**: 2026-01-19
**Status**: Draft
**Input**: Architecture Epic 010 - Stripe integration, subscription management, plan tiers (Free, Pro, Enterprise)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plan Selection & Checkout (Priority: P1)

A new or existing user wants to upgrade from the Free tier to a paid plan (Pro or Enterprise). They navigate to billing settings, compare plans, select their desired tier, and complete payment through Stripe's hosted checkout. The upgrade takes effect immediately upon successful payment.

**Why this priority**: Revenue generation is essential for SaaS sustainability. Without a functioning checkout flow, the business cannot monetize. This is the critical path for converting free users to paying customers.

**Independent Test**: Can be fully tested by navigating to billing, selecting Pro plan, completing Stripe checkout with test card, and verifying increased resource limits (3 concurrent scans, 5 team members).

**Acceptance Scenarios**:

1. **Given** a user on any plan, **When** they navigate to "Billing" in organization settings, **Then** they see a comparison of all plans with current plan highlighted.

2. **Given** a Free tier user viewing billing, **When** they click "Upgrade to Pro", **Then** they are redirected to Stripe hosted checkout with the Pro plan pre-selected.

3. **Given** a user in Stripe checkout, **When** they complete payment with a valid card, **Then** they are redirected back to the app and their plan is upgraded immediately.

4. **Given** a user who just upgraded, **When** they view their organization dashboard, **Then** they see the new plan reflected and have access to increased limits.

5. **Given** a payment failure in Stripe checkout, **When** the user returns to the app, **Then** they see an error message and remain on their current plan.

6. **Given** an Enterprise tier prospect, **When** they click "Contact Sales" on the Enterprise plan, **Then** they see a contact form or are directed to schedule a demo.

---

### User Story 2 - Subscription Management (Priority: P1)

A paying customer needs to manage their subscription: view billing history, update payment method, download invoices, and cancel if needed. All subscription management happens through Stripe's customer portal to maintain PCI-DSS compliance.

**Why this priority**: Paying customers must be able to self-serve their subscription needs. This reduces support burden and is required for SaaS compliance. Equal priority with checkout as both are essential for a functioning billing system.

**Independent Test**: Can be fully tested by accessing the customer portal, updating card details, viewing/downloading an invoice, and initiating cancellation (then re-subscribing).

**Acceptance Scenarios**:

1. **Given** a paying customer, **When** they click "Manage Subscription" in billing settings, **Then** they are redirected to Stripe Customer Portal.

2. **Given** a user in the Stripe Customer Portal, **When** they update their payment method, **Then** the change takes effect for future payments.

3. **Given** a user in the Stripe Customer Portal, **When** they view invoices, **Then** they can see all historical invoices and download PDFs.

4. **Given** a user initiating cancellation, **When** they confirm cancellation in the portal, **Then** their subscription is marked for cancellation at period end.

5. **Given** a subscription marked for cancellation, **When** the user views billing in the app, **Then** they see a notice that access will downgrade to Free on [date] with option to resubscribe.

6. **Given** a canceled subscription reaching period end, **When** the webhook is received, **Then** the organization is automatically downgraded to Free tier.

---

### User Story 3 - Usage-Based Billing for AI (Priority: P2)

Organizations are charged based on their AI/LLM usage (Claude API tokens consumed). Usage is tracked per-organization and displayed in the billing dashboard. Pro plans include a usage allowance; overages are billed at the end of the billing cycle.

**Why this priority**: LLM costs are a significant operational expense. Usage-based pricing aligns costs with value delivered and enables sustainable unit economics. This is secondary to core subscription flow but essential for profitability.

**Independent Test**: Can be fully tested by running scans, viewing usage metrics in billing dashboard, and verifying overage charges appear on the next invoice.

**Acceptance Scenarios**:

1. **Given** a paying customer, **When** they view their billing dashboard, **Then** they see current period usage (tokens consumed) and remaining allowance.

2. **Given** a scan completing, **When** the AI agents finish execution, **Then** the token usage is recorded against the organization's usage for the current billing period.

3. **Given** an organization exceeding their included allowance, **When** they view billing, **Then** they see estimated overage charges for the current period.

4. **Given** a billing cycle ending with overages, **When** Stripe generates the invoice, **Then** overage charges are automatically added as a line item.

5. **Given** an organization approaching their allowance (80%), **When** the threshold is crossed, **Then** the billing admin receives an email notification.

6. **Given** a Free tier organization, **When** they exceed the free tier limits, **Then** scans are blocked with a prompt to upgrade.

---

### User Story 4 - Plan Enforcement & Resource Limits (Priority: P2)

The system enforces plan-specific resource limits: concurrent scan limits, team member limits, scan duration limits, and feature availability. Users attempting to exceed limits receive clear feedback directing them to upgrade.

**Why this priority**: Plan enforcement protects revenue and ensures fair resource allocation. Without enforcement, there's no incentive to upgrade. This is essential for the business model but requires the checkout flow first.

**Independent Test**: Can be fully tested by attempting to exceed concurrent scan limit on Free tier and verifying the scan is blocked with an upgrade prompt.

**Acceptance Scenarios**:

1. **Given** a Free tier organization with 1 running scan, **When** they attempt to start another scan, **Then** they see "Concurrent scan limit reached. Upgrade to Pro for 3 concurrent scans."

2. **Given** a Free tier organization, **When** they attempt to invite a second team member, **Then** they see "Team member limit reached. Upgrade to Pro for up to 5 team members."

3. **Given** a Free tier scan running for 30 minutes, **When** the time limit is reached, **Then** the scan is gracefully terminated with partial results saved and a notice to upgrade for longer scans.

4. **Given** a Pro tier organization, **When** they attempt to start a 4th concurrent scan, **Then** they see "Concurrent scan limit reached. Upgrade to Enterprise for 10 concurrent scans."

5. **Given** any organization, **When** they view the billing page, **Then** they see their current usage vs. limits (e.g., "2/3 concurrent scans", "4/5 team members").

6. **Given** an Enterprise feature (e.g., custom reporting templates), **When** a Pro tier user attempts to access it, **Then** they see a feature gate with Enterprise upgrade prompt.

---

### User Story 5 - Billing Webhooks & Sync (Priority: P2)

Stripe webhooks keep the application in sync with subscription state. Events like successful payments, failed payments, subscription changes, and cancellations are processed to update organization plan status reliably.

**Why this priority**: Webhooks are the source of truth for subscription state. Without reliable webhook handling, plan status can drift from reality, causing billing disputes and access issues. This is infrastructure for US1-US4.

**Independent Test**: Can be fully tested by simulating Stripe webhook events (via Stripe CLI) and verifying organization plan status updates correctly.

**Acceptance Scenarios**:

1. **Given** a `checkout.session.completed` webhook, **When** processed, **Then** the organization's plan is upgraded and `stripeSubscriptionId` is stored.

2. **Given** an `invoice.payment_succeeded` webhook, **When** processed, **Then** the payment is logged and subscription status confirmed as active.

3. **Given** an `invoice.payment_failed` webhook, **When** processed, **Then** the billing admin receives a notification and sees a "payment failed" banner in the app.

4. **Given** a `customer.subscription.deleted` webhook, **When** processed, **Then** the organization is immediately downgraded to Free tier.

5. **Given** a `customer.subscription.updated` webhook (plan change), **When** processed, **Then** the organization's plan is updated to match the new subscription.

6. **Given** any webhook received, **When** processed, **Then** the event is logged in audit logs for debugging and compliance.

7. **Given** a webhook signature verification failure, **When** processing is attempted, **Then** the webhook is rejected and a security alert is logged.

---

### User Story 6 - Annual Billing & Discounts (Priority: P3)

Customers can choose annual billing for a discount (typically 2 months free). The billing dashboard shows annual vs. monthly pricing, and customers can switch between billing intervals.

**Why this priority**: Annual billing improves cash flow and reduces churn. However, this is an optimization on the core billing flow rather than essential functionality. Can be deferred post-MVP.

**Independent Test**: Can be fully tested by selecting annual billing during checkout, verifying discounted price, and checking that the subscription renews annually.

**Acceptance Scenarios**:

1. **Given** a user viewing plan comparison, **When** they toggle "Annual billing", **Then** they see discounted annual prices (e.g., $99/month → $79/month billed annually).

2. **Given** a user selecting annual Pro plan, **When** they complete checkout, **Then** they are charged for 12 months upfront at the discounted rate.

3. **Given** an annual subscriber, **When** they view their billing dashboard, **Then** they see renewal date and total amount paid.

4. **Given** a monthly subscriber, **When** they access the customer portal, **Then** they can switch to annual billing (prorated).

5. **Given** an annual subscription approaching renewal (30 days), **When** the date arrives, **Then** the billing admin receives a renewal reminder email.

---

### Edge Cases

- **Duplicate webhook events**: Webhook handler must be idempotent - processing the same event twice should have no additional effect.
- **Webhook delivery failures**: Stripe retries webhooks with exponential backoff. System should handle out-of-order delivery gracefully.
- **Mid-cycle plan changes**: Upgrading mid-cycle applies immediately; downgrading takes effect at period end to avoid refund complexity.
- **Payment method expiration**: When a card expires before renewal, Stripe sends `invoice.payment_failed`. User sees banner and has grace period (3 days) to update.
- **Organization deletion with active subscription**: Deleting an organization triggers subscription cancellation in Stripe.
- **Multiple billing admins**: Stripe customer portal access is available to any Owner or Admin role.
- **Payment service unavailability**: If payment service is temporarily unavailable during checkout, display "Payment service temporarily unavailable" with retry button. Webhook processing uses exponential backoff retry (handled by payment provider).
- **Currency handling**: Initial MVP supports USD only. Multi-currency support deferred to future iteration.
- **Tax handling**: Stripe Tax integration deferred. Initial pricing is tax-exclusive; customers in applicable jurisdictions handle tax reporting.
- **Refunds**: Refunds are handled manually through Stripe Dashboard by support staff. No self-service refund flow.
- **Free tier → Enterprise**: Direct upgrade path exists; no requirement to go through Pro first.
- **Trial periods**: No free trial initially. Free tier serves as the "trial" experience.
- **Proration**: Stripe handles proration automatically for mid-cycle upgrades.

## Requirements *(mandatory)*

### Functional Requirements

**Plan Management:**
- **FR-001**: System MUST support three plan tiers: Free, Pro ($99/month), Enterprise (custom pricing via sales).
- **FR-002**: System MUST display plan comparison showing features, limits, and pricing for all tiers.
- **FR-003**: System MUST redirect to Stripe hosted checkout for all payment processing (PCI-DSS compliance).
- **FR-004**: System MUST update organization plan immediately upon successful checkout completion.
- **FR-005**: System MUST redirect Enterprise prospects to a sales contact form.

**Subscription Management:**
- **FR-006**: System MUST provide access to Stripe Customer Portal for subscription management.
- **FR-007**: System MUST allow customers to view, update payment method, and download invoices via Customer Portal.
- **FR-008**: System MUST support subscription cancellation with access maintained until period end.
- **FR-009**: System MUST automatically downgrade organizations to Free tier when subscription ends.

**Usage Tracking:**
- **FR-010**: System MUST track LLM token usage per organization per billing period.
- **FR-010a**: Default monthly token allowances: Free (50,000), Pro (500,000), Enterprise (5,000,000). These values are configurable per-plan without code changes.
- **FR-011**: System MUST display current usage and remaining allowance in billing dashboard.
- **FR-012**: System MUST send notification when usage reaches 80% of allowance.
- **FR-013**: System MUST report usage overages to Stripe for metered billing at period end.
- **FR-013a**: Overage rate: $1.00 per 1,000,000 tokens beyond included allowance.

**Plan Enforcement:**
- **FR-014**: System MUST enforce concurrent scan limits: Free (1), Pro (3), Enterprise (10).
- **FR-015**: System MUST enforce team member limits: Free (1), Pro (5), Enterprise (unlimited).
- **FR-016**: System MUST enforce scan duration limits: Free (30 min), Pro (60 min), Enterprise (120 min).
- **FR-017**: System MUST display clear upgrade prompts when limits are reached.
- **FR-018**: System MUST gracefully terminate scans that exceed duration limits.

**Webhook Processing:**
- **FR-019**: System MUST process Stripe webhooks for: checkout.session.completed, invoice.payment_succeeded, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted.
- **FR-020**: System MUST verify webhook signatures using Stripe webhook secret.
- **FR-021**: System MUST handle webhooks idempotently (duplicate events have no additional effect).
- **FR-022**: System MUST log all webhook events in audit logs.

**Billing Information:**
- **FR-023**: System MUST store Stripe customer ID and subscription ID on organization record.
- **FR-024**: System MUST display subscription status, next billing date, and plan details in billing dashboard.
- **FR-025**: System MUST support annual billing with discount (2 months free equivalent).

**Billing Access Control:**
- **FR-026**: Owners and Admins can access full billing management (upgrade, cancel, manage payment methods, view invoices).
- **FR-027**: Members can view usage dashboard and current plan details but cannot modify subscription.
- **FR-028**: Viewers have no access to billing information.

### Key Entities

- **Organization** (extended): Adds billing-related attributes: plan (free/pro/enterprise), stripeCustomerId, stripeSubscriptionId, billingEmail, subscriptionStatus (active/past_due/canceled), currentPeriodEnd.

- **UsageRecord**: Tracks LLM token consumption per organization. Key attributes: organizationId, periodStart, periodEnd, tokensUsed, tokensAllowance, reportedToStripe.

- **BillingEvent**: Audit trail for billing-related events. Key attributes: organizationId, eventType (upgrade/downgrade/payment_success/payment_failed/webhook), stripeEventId, metadata, timestamp.

- **PlanLimits**: Configuration for plan-specific limits. Key attributes: planId, concurrentScans, teamMembers, scanDurationMinutes, monthlyTokenAllowance, features.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of checkout sessions complete successfully (no payment failures or abandonment due to technical issues).

- **SC-002**: Webhook processing achieves 99.9% success rate with no missed events.

- **SC-003**: Plan enforcement correctly blocks 100% of limit-exceeding requests (no leakage).

- **SC-004**: Billing dashboard load time under 2 seconds for usage and subscription information.

- **SC-005**: Zero PCI-DSS compliance issues (all payment data handled by Stripe, never touches our servers).

- **SC-006**: 80% of upgrade prompts shown result in billing page visit (effective upsell messaging).

- **SC-007**: Less than 1% of customer support tickets relate to billing/subscription issues.

- **SC-008**: Usage reporting to Stripe for metered billing achieves 100% accuracy.

- **SC-009**: Annual plan adoption rate of 30%+ among paying customers (validates discount strategy).

- **SC-010**: Involuntary churn (failed payments) under 2% per month.

## Clarifications

### Session 2026-01-19

- Q: What monthly token allowance should each plan include? → A: Free (50,000), Pro (500,000), Enterprise (5,000,000) tokens/month; configurable per-plan without code changes.
- Q: What should the overage rate be for tokens beyond included allowance? → A: $1.00 per 1,000,000 tokens.
- Q: Who should have access to billing features? → A: Owners and Admins can manage billing; Members can view usage only; Viewers have no billing access.
- Q: How should the system behave when payment service is unavailable? → A: Show specific error message with retry button; webhooks auto-retry with exponential backoff.

## Assumptions

The following assumptions were made based on industry standards and architecture context:

1. **Currency**: USD only for initial release. Multi-currency support deferred to future iteration.

2. **Tax handling**: Tax compliance handled externally. Initial pricing is tax-exclusive; Stripe Tax integration deferred.

3. **Refund process**: Refunds are processed manually via Stripe Dashboard by support staff. No self-service refund flow initially.

4. **Trial periods**: No free trial. The Free tier with limited features serves as the "try before you buy" experience.

5. **Grace period**: 3 days grace period for failed payment recovery before service degradation (industry standard).

6. **Billing intervals**: Monthly and annual billing only. Custom billing cycles deferred.

7. **Enterprise pricing**: Enterprise tier is contact-sales only, not self-serve checkout.

8. **Proration**: Mid-cycle upgrades are prorated automatically by the payment processor. Downgrades take effect at period end.

9. **Payment methods**: Credit/debit cards only initially. ACH, wire transfers, and invoicing deferred to Enterprise custom arrangements.

10. **Notification channel**: Email is the primary notification channel for billing alerts (80% usage, payment failures, renewal reminders).
