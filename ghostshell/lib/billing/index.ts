/**
 * Billing Module
 * Exports for billing feature (Epic 010)
 */

// Types
export * from "./types";

// Plan limits configuration
export * from "./plan-limits";

// Stripe client (selective exports)
export {
  getOrCreateStripeCustomer,
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  cancelSubscription,
  reactivateSubscription,
  reportUsageToStripe,
  constructWebhookEvent,
  getPriceId,
  getOrganizationIdFromMetadata,
  mapStripeStatus,
  STRIPE_PRICES,
} from "./stripe-client";

// Webhook handlers
export {
  processWebhookEvent,
  isEventProcessed,
  logBillingEvent,
  handleCheckoutCompleted,
  handlePaymentSucceeded,
  handlePaymentFailed,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from "./webhook-handlers";
