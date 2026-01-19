/**
 * Billing & Subscription Types
 * Core type definitions for billing feature (Epic 010)
 */

// Plan types
export type PlanType = "free" | "pro" | "enterprise";

// Subscription status aligned with Stripe
export type SubscriptionStatus = "inactive" | "active" | "past_due" | "canceled";

// Billing event types for audit trail
export type BillingEventType =
  | "checkout_started"
  | "checkout_completed"
  | "payment_succeeded"
  | "payment_failed"
  | "subscription_updated"
  | "subscription_canceled"
  | "usage_reported";

// Billing interval for pricing
export type BillingInterval = "monthly" | "annual";

// Plan feature flags
export interface PlanFeatures {
  customReports: boolean;
  apiAccess: boolean;
  scheduledScans: boolean;
}

// Plan limits configuration
export interface PlanLimitsConfig {
  planName: PlanType;
  concurrentScans: number;
  teamMembers: number;
  scanDurationMinutes: number;
  monthlyTokenAllowance: number;
  features: PlanFeatures;
  monthlyPriceUsd: number;
  annualPriceUsd: number | null;
}

// Usage summary for billing dashboard
export interface UsageSummary {
  tokensUsed: number;
  tokensAllowance: number;
  percentage: number;
  remaining: number;
  periodStart: Date;
  periodEnd: Date;
}

// Overage information
export interface OverageInfo {
  tokens: number;
  cost: number; // in USD
}

// Billing info response
export interface BillingInfo {
  plan: PlanType;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  billingEmail: string | null;
  limits: PlanLimitsConfig;
  usage: UsageSummary | null;
}

// Checkout session request
export interface CreateCheckoutRequest {
  organizationId: string;
  priceId: string;
  successUrl?: string;
  cancelUrl?: string;
}

// Portal session request
export interface CreatePortalRequest {
  organizationId: string;
  returnUrl?: string;
}

// Checkout session response
export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

// Portal session response
export interface PortalSessionResponse {
  url: string;
}

// Webhook event metadata types
export interface CheckoutCompletedMetadata {
  plan: PlanType;
  interval: BillingInterval;
  amount: number;
  currency: string;
}

export interface PaymentFailedMetadata {
  attemptCount: number;
  lastError: string;
  nextRetry: string | null;
}

export interface UsageReportedMetadata {
  tokensReported: number;
  periodStart: string;
  periodEnd: string;
}

// Stripe price IDs configuration
export interface StripePriceConfig {
  proMonthly: string;
  proAnnual: string;
}

// Billing access roles
export type BillingAccessLevel = "manage" | "view" | "none";

// Map organization roles to billing access
export const BILLING_ACCESS_BY_ROLE: Record<string, BillingAccessLevel> = {
  owner: "manage",
  admin: "manage",
  member: "view",
  viewer: "none",
};
