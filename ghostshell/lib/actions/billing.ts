"use server";

import { db } from "@/lib/db";
import { getCurrentUser, hasOrgAccess, getUserOrgRole } from "@/lib/auth";
import {
  getOrCreateStripeCustomer,
  createCheckoutSession as stripeCreateCheckout,
  createPortalSession as stripeCreatePortal,
  STRIPE_PRICES,
} from "@/lib/billing/stripe-client";
import {
  getPlanLimits,
  PLAN_CONFIG,
} from "@/lib/billing/plan-limits";
import type {
  PlanType,
  BillingInterval,
  BillingInfo,
  BillingAccessLevel,
  CheckoutSessionResponse,
  PortalSessionResponse,
} from "@/lib/billing/types";
import { BILLING_ACCESS_BY_ROLE } from "@/lib/billing/types";

/**
 * Get billing access level for current user in an organization
 */
export async function getBillingAccessLevel(
  orgId: string
): Promise<BillingAccessLevel> {
  const role = await getUserOrgRole(orgId);
  if (!role) return "none";
  return BILLING_ACCESS_BY_ROLE[role] ?? "none";
}

/**
 * Check if user can manage billing (create checkout, portal sessions)
 */
export async function canManageBilling(orgId: string): Promise<boolean> {
  const access = await getBillingAccessLevel(orgId);
  return access === "manage";
}

/**
 * Check if user can view billing (see usage stats)
 */
export async function canViewBilling(orgId: string): Promise<boolean> {
  const access = await getBillingAccessLevel(orgId);
  return access === "manage" || access === "view";
}

/**
 * Get organization billing information
 */
export async function getOrganizationBilling(
  orgId: string
): Promise<BillingInfo | null> {
  const canView = await canViewBilling(orgId);
  if (!canView) {
    return null;
  }

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      plan: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      billingEmail: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });

  if (!org) {
    return null;
  }

  const plan = org.plan as PlanType;
  const limits = getPlanLimits(plan);

  // Get current period usage
  const now = new Date();
  const usageRecord = await db.usageRecord.findFirst({
    where: {
      organizationId: orgId,
      periodStart: { lte: now },
      periodEnd: { gt: now },
    },
    orderBy: { periodStart: "desc" },
  });

  return {
    plan,
    subscriptionStatus: org.subscriptionStatus as BillingInfo["subscriptionStatus"],
    currentPeriodEnd: org.currentPeriodEnd,
    billingEmail: org.billingEmail,
    limits,
    usage: usageRecord
      ? {
          tokensUsed: usageRecord.tokensUsed,
          tokensAllowance: usageRecord.tokensAllowance,
          percentage: Math.min(
            100,
            Math.round((usageRecord.tokensUsed / usageRecord.tokensAllowance) * 100)
          ),
          remaining: Math.max(0, usageRecord.tokensAllowance - usageRecord.tokensUsed),
          periodStart: usageRecord.periodStart,
          periodEnd: usageRecord.periodEnd,
        }
      : null,
  };
}

/**
 * Create a checkout session for plan upgrade
 */
export async function createCheckoutSessionAction(params: {
  organizationId: string;
  plan: "pro";
  interval: BillingInterval;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<CheckoutSessionResponse> {
  // Verify user can manage billing
  const canManage = await canManageBilling(params.organizationId);
  if (!canManage) {
    throw new Error("Not authorized to manage billing");
  }

  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  // Get organization
  const org = await db.organization.findUnique({
    where: { id: params.organizationId },
    select: {
      id: true,
      name: true,
      billingEmail: true,
      stripeCustomerId: true,
    },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  // Get or create Stripe customer
  const email = org.billingEmail || user.email;
  const customerId = await getOrCreateStripeCustomer(org.id, email, org.name);

  // Determine price ID
  const priceId =
    params.interval === "annual"
      ? STRIPE_PRICES.proAnnual
      : STRIPE_PRICES.proMonthly;

  if (!priceId) {
    throw new Error("Price not configured");
  }

  // Build URLs
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const successUrl =
    params.successUrl ||
    `${baseUrl}/org/${params.organizationId}/billing?success=true`;
  const cancelUrl =
    params.cancelUrl ||
    `${baseUrl}/org/${params.organizationId}/billing?cancelled=true`;

  // Create checkout session
  const session = await stripeCreateCheckout({
    organizationId: params.organizationId,
    customerId,
    priceId,
    successUrl,
    cancelUrl,
  });

  // Log checkout started event
  await db.billingEvent.create({
    data: {
      organizationId: params.organizationId,
      eventType: "checkout_started",
      stripeEventId: `checkout_started_${session.sessionId}`,
      metadata: {
        plan: params.plan,
        interval: params.interval,
        sessionId: session.sessionId,
      },
    },
  });

  return session;
}

/**
 * Create a portal session for subscription management
 */
export async function createPortalSessionAction(params: {
  organizationId: string;
  returnUrl?: string;
}): Promise<PortalSessionResponse> {
  // Verify user can manage billing
  const canManage = await canManageBilling(params.organizationId);
  if (!canManage) {
    throw new Error("Not authorized to manage billing");
  }

  // Get organization with Stripe customer ID
  const org = await db.organization.findUnique({
    where: { id: params.organizationId },
    select: {
      stripeCustomerId: true,
      subscriptionStatus: true,
    },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  if (!org.stripeCustomerId) {
    throw new Error("No billing account found. Please subscribe to a plan first.");
  }

  // Build return URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const returnUrl =
    params.returnUrl || `${baseUrl}/org/${params.organizationId}/billing`;

  // Create portal session
  return stripeCreatePortal({
    customerId: org.stripeCustomerId,
    returnUrl,
  });
}

/**
 * Get all available plans for display
 */
export async function getAvailablePlans() {
  return Object.values(PLAN_CONFIG).map((config) => ({
    name: config.planName,
    displayName: config.planName.charAt(0).toUpperCase() + config.planName.slice(1),
    monthlyPrice: config.monthlyPriceUsd,
    annualPrice: config.annualPriceUsd,
    limits: {
      concurrentScans: config.concurrentScans,
      teamMembers: config.teamMembers,
      scanDurationMinutes: config.scanDurationMinutes,
      monthlyTokenAllowance: config.monthlyTokenAllowance,
    },
    features: config.features,
  }));
}
