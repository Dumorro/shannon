/**
 * Stripe Client Wrapper
 * Centralized Stripe API access for billing operations (Epic 010)
 */

import Stripe from "stripe";
import { db } from "@/lib/db";
import type { PlanType, BillingInterval } from "./types";

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
  typescript: true,
});

// Price ID configuration from environment
export const STRIPE_PRICES = {
  proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
  proAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL!,
};

/**
 * Get or create a Stripe customer for an organization
 */
export async function getOrCreateStripeCustomer(
  organizationId: string,
  email: string,
  name: string
): Promise<string> {
  // Check if organization already has a Stripe customer ID
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { stripeCustomerId: true },
  });

  if (org?.stripeCustomerId) {
    return org.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      organizationId,
    },
  });

  // Store the customer ID
  await db.organization.update({
    where: { id: organizationId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout session for plan upgrade
 */
export async function createCheckoutSession(params: {
  organizationId: string;
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string }> {
  const session = await stripe.checkout.sessions.create({
    customer: params.customerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      organizationId: params.organizationId,
    },
    subscription_data: {
      metadata: {
        organizationId: params.organizationId,
      },
    },
    allow_promotion_codes: true,
  });

  return {
    sessionId: session.id,
    url: session.url!,
  };
}

/**
 * Create a Stripe Customer Portal session
 */
export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });

  return { url: session.url };
}

/**
 * Get subscription details from Stripe
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    if ((error as Stripe.StripeAPIError).code === "resource_missing") {
      return null;
    }
    throw error;
  }
}

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Reactivate a subscription that was set to cancel
 */
export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Report usage to Stripe for metered billing
 */
export async function reportUsageToStripe(params: {
  subscriptionId: string;
  quantity: number;
  timestamp?: number;
}): Promise<void> {
  const subscription = await stripe.subscriptions.retrieve(params.subscriptionId);

  // Find the metered item (if metered billing is configured)
  const meteredItem = subscription.items.data.find(
    (item) => item.price.recurring?.usage_type === "metered"
  );

  if (meteredItem) {
    await stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
      quantity: params.quantity,
      timestamp: params.timestamp ?? Math.floor(Date.now() / 1000),
      action: "increment",
    });
  }
}

/**
 * Construct and verify a Stripe webhook event
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}

/**
 * Get the price ID for a plan and interval
 */
export function getPriceId(plan: PlanType, interval: BillingInterval): string | null {
  if (plan === "pro") {
    return interval === "annual" ? STRIPE_PRICES.proAnnual : STRIPE_PRICES.proMonthly;
  }
  // Free and Enterprise don't have Stripe prices
  return null;
}

/**
 * Extract organization ID from Stripe metadata
 */
export function getOrganizationIdFromMetadata(
  metadata: Stripe.Metadata | null | undefined
): string | null {
  return metadata?.organizationId ?? null;
}

/**
 * Map Stripe subscription status to our status
 */
export function mapStripeStatus(
  status: Stripe.Subscription.Status
): "active" | "past_due" | "canceled" | "inactive" {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "inactive";
  }
}

/**
 * Export the raw Stripe client for advanced operations
 */
export { stripe };
