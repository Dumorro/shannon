/**
 * Stripe Webhook Event Handlers
 * Processes Stripe webhook events and updates organization state (Epic 010)
 */

import Stripe from "stripe";
import { db } from "@/lib/db";
import { mapStripeStatus, getOrganizationIdFromMetadata } from "./stripe-client";
import { getPlanLimits } from "./plan-limits";
import type { PlanType, BillingEventType } from "./types";

/**
 * Check if an event has already been processed (idempotency)
 */
export async function isEventProcessed(stripeEventId: string): Promise<boolean> {
  const existing = await db.billingEvent.findUnique({
    where: { stripeEventId },
  });
  return existing !== null;
}

/**
 * Log a billing event for audit trail
 */
export async function logBillingEvent(params: {
  organizationId: string;
  eventType: BillingEventType;
  stripeEventId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.billingEvent.create({
    data: {
      organizationId: params.organizationId,
      eventType: params.eventType,
      stripeEventId: params.stripeEventId,
      metadata: params.metadata ?? null,
    },
  });
}

/**
 * Handle checkout.session.completed event
 * Called when a customer completes the checkout flow
 */
export async function handleCheckoutCompleted(
  event: Stripe.Event
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const organizationId = getOrganizationIdFromMetadata(session.metadata);

  if (!organizationId) {
    console.error("No organizationId in checkout session metadata:", session.id);
    return;
  }

  // Check idempotency
  if (await isEventProcessed(event.id)) {
    console.log("Event already processed:", event.id);
    return;
  }

  // Get subscription details
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  // Determine plan from price
  let plan: PlanType = "pro"; // Default to pro for checkout

  // Update organization with subscription info
  await db.organization.update({
    where: { id: organizationId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: "active",
      plan,
      currentPeriodEnd: null, // Will be set by subscription.updated event
    },
  });

  // Create usage record for new billing period
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const planLimits = getPlanLimits(plan);

  await db.usageRecord.upsert({
    where: {
      organizationId_periodStart: {
        organizationId,
        periodStart: now,
      },
    },
    update: {},
    create: {
      organizationId,
      periodStart: now,
      periodEnd,
      tokensUsed: 0,
      tokensAllowance: planLimits.monthlyTokenAllowance,
    },
  });

  // Log event
  await logBillingEvent({
    organizationId,
    eventType: "checkout_completed",
    stripeEventId: event.id,
    metadata: {
      plan,
      subscriptionId,
      customerId,
      sessionId: session.id,
    },
  });

  console.log("Checkout completed for organization:", organizationId);
}

/**
 * Handle invoice.payment_succeeded event
 * Called when a recurring payment is successful
 */
export async function handlePaymentSucceeded(
  event: Stripe.Event
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    return; // Not a subscription invoice
  }

  // Check idempotency
  if (await isEventProcessed(event.id)) {
    console.log("Event already processed:", event.id);
    return;
  }

  // Find organization by subscription ID
  const org = await db.organization.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!org) {
    console.error("No organization found for subscription:", subscriptionId);
    return;
  }

  // Update subscription status to active (in case it was past_due)
  await db.organization.update({
    where: { id: org.id },
    data: {
      subscriptionStatus: "active",
    },
  });

  // Log event
  await logBillingEvent({
    organizationId: org.id,
    eventType: "payment_succeeded",
    stripeEventId: event.id,
    metadata: {
      invoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
    },
  });

  console.log("Payment succeeded for organization:", org.id);
}

/**
 * Handle invoice.payment_failed event
 * Called when a payment attempt fails
 */
export async function handlePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    return; // Not a subscription invoice
  }

  // Check idempotency
  if (await isEventProcessed(event.id)) {
    console.log("Event already processed:", event.id);
    return;
  }

  // Find organization by subscription ID
  const org = await db.organization.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!org) {
    console.error("No organization found for subscription:", subscriptionId);
    return;
  }

  // Update subscription status to past_due
  await db.organization.update({
    where: { id: org.id },
    data: {
      subscriptionStatus: "past_due",
    },
  });

  // Log event
  await logBillingEvent({
    organizationId: org.id,
    eventType: "payment_failed",
    stripeEventId: event.id,
    metadata: {
      invoiceId: invoice.id,
      attemptCount: invoice.attempt_count,
      lastError: invoice.last_finalization_error?.message,
      nextRetry: invoice.next_payment_attempt
        ? new Date(invoice.next_payment_attempt * 1000).toISOString()
        : null,
    },
  });

  console.log("Payment failed for organization:", org.id);
}

/**
 * Handle customer.subscription.updated event
 * Called when subscription details change
 */
export async function handleSubscriptionUpdated(
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  // Check idempotency
  if (await isEventProcessed(event.id)) {
    console.log("Event already processed:", event.id);
    return;
  }

  // Try to find organization by subscription ID
  let org = await db.organization.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  // If not found by subscription ID, try metadata
  if (!org) {
    const organizationId = getOrganizationIdFromMetadata(subscription.metadata);
    if (organizationId) {
      org = await db.organization.findUnique({
        where: { id: organizationId },
      });
    }
  }

  if (!org) {
    console.error("No organization found for subscription:", subscription.id);
    return;
  }

  // Map Stripe status to our status
  const status = mapStripeStatus(subscription.status);

  // Update organization
  await db.organization.update({
    where: { id: org.id },
    data: {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  // Log event
  await logBillingEvent({
    organizationId: org.id,
    eventType: "subscription_updated",
    stripeEventId: event.id,
    metadata: {
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: new Date(
        subscription.current_period_end * 1000
      ).toISOString(),
    },
  });

  console.log("Subscription updated for organization:", org.id);
}

/**
 * Handle customer.subscription.deleted event
 * Called when a subscription is cancelled
 */
export async function handleSubscriptionDeleted(
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  // Check idempotency
  if (await isEventProcessed(event.id)) {
    console.log("Event already processed:", event.id);
    return;
  }

  // Find organization by subscription ID
  const org = await db.organization.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!org) {
    console.error("No organization found for subscription:", subscription.id);
    return;
  }

  // Downgrade to free plan
  await db.organization.update({
    where: { id: org.id },
    data: {
      plan: "free",
      subscriptionStatus: "canceled",
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
    },
  });

  // Log event
  await logBillingEvent({
    organizationId: org.id,
    eventType: "subscription_canceled",
    stripeEventId: event.id,
    metadata: {
      previousPlan: org.plan,
      canceledAt: new Date().toISOString(),
    },
  });

  console.log("Subscription deleted for organization:", org.id);
}

/**
 * Process a Stripe webhook event
 * Main entry point for webhook handling
 */
export async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  console.log("Processing webhook event:", event.type, event.id);

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event);
      break;

    case "invoice.payment_succeeded":
      await handlePaymentSucceeded(event);
      break;

    case "invoice.payment_failed":
      await handlePaymentFailed(event);
      break;

    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event);
      break;

    default:
      console.log("Unhandled event type:", event.type);
  }
}
