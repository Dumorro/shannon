# Quickstart: Billing & Subscriptions

**Feature**: 010-billing
**Date**: 2026-01-19

## Prerequisites

Before implementing billing, ensure you have:

1. **Stripe Account**: Create at [stripe.com](https://stripe.com)
2. **Products & Prices**: Create in Stripe Dashboard
3. **Webhook Endpoint**: Configure in Stripe Dashboard
4. **Environment Variables**: Set up API keys

## Environment Setup

Add to `.env.local`:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...      # From Stripe Dashboard > Developers > API Keys
STRIPE_WEBHOOK_SECRET=whsec_...    # From Stripe Dashboard > Webhooks

# Price IDs (create products first in Stripe)
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
```

## Stripe Dashboard Setup

### 1. Create Products

In Stripe Dashboard > Products:

**Pro Plan**
- Name: "Shannon Pro"
- Monthly Price: $99.00 USD (recurring)
- Annual Price: $990.00 USD (recurring)
- Copy the Price IDs to environment variables

**Enterprise Plan**
- Name: "Shannon Enterprise"
- Custom pricing (handled via sales)

### 2. Configure Customer Portal

In Stripe Dashboard > Settings > Billing > Customer Portal:

Enable:
- Update payment methods
- View invoice history
- Cancel subscriptions
- Switch plans (Pro monthly ↔ annual)

### 3. Create Webhook Endpoint

In Stripe Dashboard > Developers > Webhooks:

**Endpoint URL**: `https://your-domain.com/api/webhooks/stripe`

**Events to subscribe**:
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the Signing Secret to `STRIPE_WEBHOOK_SECRET`.

## Database Migration

Run Prisma migration:

```bash
cd ghostshell
npx prisma migrate dev --name add_billing
```

Seed plan configuration:

```bash
npx prisma db seed
```

## Implementation Order

### Phase 1: Core Infrastructure (US1, US2)

1. **Install Dependencies**
   ```bash
   npm install stripe
   ```

2. **Create Stripe Client**
   ```typescript
   // ghostshell/lib/billing/stripe-client.ts
   import Stripe from 'stripe';

   export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
     apiVersion: '2024-12-18.acacia',
   });
   ```

3. **Create Plan Limits Config**
   ```typescript
   // ghostshell/lib/billing/plan-limits.ts
   export const PLAN_CONFIG = {
     free: { concurrentScans: 1, teamMembers: 1, ... },
     pro: { concurrentScans: 3, teamMembers: 5, ... },
     enterprise: { concurrentScans: 10, teamMembers: Infinity, ... },
   };
   ```

4. **Implement Checkout Endpoint**
   ```typescript
   // ghostshell/app/api/billing/checkout/route.ts
   export async function POST(req: Request) {
     const { organizationId, priceId } = await req.json();
     const session = await stripe.checkout.sessions.create({
       customer: org.stripeCustomerId,
       line_items: [{ price: priceId, quantity: 1 }],
       mode: 'subscription',
       success_url: `${origin}/org/${organizationId}/billing?success=true`,
       cancel_url: `${origin}/org/${organizationId}/billing?cancelled=true`,
       metadata: { organizationId },
     });
     return Response.json({ url: session.url });
   }
   ```

5. **Implement Webhook Handler**
   ```typescript
   // ghostshell/app/api/webhooks/stripe/route.ts
   export async function POST(req: Request) {
     const signature = headers().get('stripe-signature')!;
     const event = stripe.webhooks.constructEvent(
       await req.text(),
       signature,
       process.env.STRIPE_WEBHOOK_SECRET!
     );

     switch (event.type) {
       case 'checkout.session.completed':
         await handleCheckoutCompleted(event.data.object);
         break;
       // ... other events
     }

     return Response.json({ received: true });
   }
   ```

### Phase 2: Usage Tracking (US3)

1. **Create Usage Tracker**
   ```typescript
   // ghostshell/lib/billing/usage-tracker.ts
   export async function recordTokenUsage(
     organizationId: string,
     tokensConsumed: number
   ) {
     await db.usageRecord.upsert({
       where: { organizationId_periodStart: { ... } },
       update: { tokensUsed: { increment: tokensConsumed } },
       create: { ... },
     });
   }
   ```

2. **Integrate with Scan Completion**
   - Hook into `completeScan()` to call `recordTokenUsage()`
   - Check allowance before starting new scans

### Phase 3: Plan Enforcement (US4)

1. **Update Concurrent Limit Check**
   ```typescript
   // Update ghostshell/lib/scan-queue.ts
   import { getConcurrentLimit } from './billing/plan-limits';

   export async function checkConcurrentLimit(orgId: string) {
     const limit = await getConcurrentLimit(orgId);
     // ... existing logic
   }
   ```

2. **Add Duration Monitoring to Temporal**
   - Check elapsed time against plan limit
   - Graceful termination with partial report

### Phase 4: UI Components

1. **Billing Dashboard Page**
   - Plan comparison component
   - Subscription status card
   - Usage indicator with progress bar

2. **Upgrade Prompts**
   - Show when limits reached
   - Include upgrade button linking to billing page

## Testing

### Local Webhook Testing

Use Stripe CLI:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
```

### Test Checkout Flow

1. Use test card: `4242 4242 4242 4242`
2. Any future expiry date
3. Any CVC

### Test Payment Failure

Use test card: `4000 0000 0000 0341` (always fails)

## Verification Checklist

- [ ] Stripe products and prices created
- [ ] Webhook endpoint configured and verified
- [ ] Environment variables set
- [ ] Database migration applied
- [ ] Checkout flow works end-to-end
- [ ] Customer portal accessible
- [ ] Webhook events processed correctly
- [ ] Plan limits enforced
- [ ] Usage tracking records tokens
- [ ] Upgrade prompts display correctly

## Common Issues

### Webhook Signature Verification Fails

- Ensure `STRIPE_WEBHOOK_SECRET` matches Dashboard value
- Check that raw body is used (not parsed JSON)
- Verify endpoint URL matches exactly

### Customer Portal Not Working

- Ensure organization has `stripeCustomerId`
- Customer Portal must be enabled in Stripe Dashboard
- User must have Owner/Admin role

### Usage Not Tracking

- Check that `completeScan()` calls `recordTokenUsage()`
- Verify `ScanResult.totalTokensUsed` is populated
- Check for errors in server logs

## Resources

- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/customer-portal)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)
