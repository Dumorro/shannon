/**
 * Unit tests for Stripe webhook handlers (Epic 010 - US5)
 * Tests idempotency, state updates, and error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

// Mock modules using factory functions
vi.mock("@/lib/db", () => ({
  db: {
    billingEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    usageRecord: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/billing/stripe-client", () => ({
  mapStripeStatus: vi.fn((status: string) => {
    const map: Record<string, string> = {
      active: "active",
      past_due: "past_due",
      canceled: "canceled",
      unpaid: "past_due",
      trialing: "active",
    };
    return map[status] || "active";
  }),
  getOrganizationIdFromMetadata: vi.fn(
    (metadata?: Record<string, string> | null) => metadata?.organizationId
  ),
}));

vi.mock("@/lib/billing/plan-limits", () => ({
  getPlanLimits: vi.fn(() => ({
    monthlyTokenAllowance: 500000,
    concurrentScans: 3,
    teamMembers: 5,
    scanDurationMinutes: 60,
    features: ["advanced_reporting"],
  })),
}));

// Import db after mock is set up
import { db } from "@/lib/db";

import {
  isEventProcessed,
  logBillingEvent,
  handleCheckoutCompleted,
  handlePaymentSucceeded,
  handlePaymentFailed,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  processWebhookEvent,
} from "@/lib/billing/webhook-handlers";

// Get typed mock references
const mockDb = vi.mocked(db);

// Helper to create mock Stripe events
function createMockEvent(
  type: string,
  data: Record<string, unknown>,
  id = "evt_test_123"
): Stripe.Event {
  return {
    id,
    type,
    data: { object: data },
    api_version: "2023-10-16",
    created: Date.now() / 1000,
    livemode: false,
    object: "event",
    pending_webhooks: 0,
    request: null,
  } as Stripe.Event;
}

describe("webhook-handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isEventProcessed", () => {
    it("returns true if event exists in database", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue({
        id: "be_1",
        stripeEventId: "evt_123",
        organizationId: "org_1",
        eventType: "checkout_completed",
        metadata: null,
        createdAt: new Date(),
      });

      const result = await isEventProcessed("evt_123");

      expect(result).toBe(true);
      expect(mockDb.billingEvent.findUnique).toHaveBeenCalledWith({
        where: { stripeEventId: "evt_123" },
      });
    });

    it("returns false if event does not exist", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue(null);

      const result = await isEventProcessed("evt_new");

      expect(result).toBe(false);
    });
  });

  describe("logBillingEvent", () => {
    it("creates billing event record", async () => {
      mockDb.billingEvent.create.mockResolvedValue({
        id: "be_1",
        stripeEventId: "evt_123",
        organizationId: "org_123",
        eventType: "checkout_completed",
        metadata: { plan: "pro" },
        createdAt: new Date(),
      });

      await logBillingEvent({
        organizationId: "org_123",
        eventType: "checkout_completed",
        stripeEventId: "evt_123",
        metadata: { plan: "pro" },
      });

      expect(mockDb.billingEvent.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org_123",
          eventType: "checkout_completed",
          stripeEventId: "evt_123",
          metadata: { plan: "pro" },
        },
      });
    });

    it("handles missing metadata", async () => {
      mockDb.billingEvent.create.mockResolvedValue({
        id: "be_1",
        stripeEventId: "evt_456",
        organizationId: "org_123",
        eventType: "payment_succeeded",
        metadata: null,
        createdAt: new Date(),
      });

      await logBillingEvent({
        organizationId: "org_123",
        eventType: "payment_succeeded",
        stripeEventId: "evt_456",
      });

      expect(mockDb.billingEvent.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org_123",
          eventType: "payment_succeeded",
          stripeEventId: "evt_456",
          metadata: null,
        },
      });
    });
  });

  describe("handleCheckoutCompleted", () => {
    const mockSession = {
      id: "cs_test_123",
      subscription: "sub_123",
      customer: "cus_123",
      metadata: { organizationId: "org_123" },
    };

    it("updates organization on successful checkout", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue(null); // Not processed
      mockDb.organization.update.mockResolvedValue({} as never);
      mockDb.usageRecord.upsert.mockResolvedValue({} as never);
      mockDb.billingEvent.create.mockResolvedValue({} as never);

      const event = createMockEvent("checkout.session.completed", mockSession);
      await handleCheckoutCompleted(event);

      expect(mockDb.organization.update).toHaveBeenCalledWith({
        where: { id: "org_123" },
        data: expect.objectContaining({
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_123",
          subscriptionStatus: "active",
          plan: "pro",
        }),
      });
    });

    it("creates usage record for new billing period", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue(null);
      mockDb.organization.update.mockResolvedValue({} as never);
      mockDb.usageRecord.upsert.mockResolvedValue({} as never);
      mockDb.billingEvent.create.mockResolvedValue({} as never);

      const event = createMockEvent("checkout.session.completed", mockSession);
      await handleCheckoutCompleted(event);

      expect(mockDb.usageRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            organizationId: "org_123",
            tokensUsed: 0,
            tokensAllowance: 500000,
          }),
        })
      );
    });

    it("skips duplicate events (idempotency)", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue({
        id: "be_1",
        stripeEventId: "evt_test_123",
        organizationId: "org_1",
        eventType: "checkout_completed",
        metadata: null,
        createdAt: new Date(),
      });

      const event = createMockEvent("checkout.session.completed", mockSession);
      await handleCheckoutCompleted(event);

      expect(mockDb.organization.update).not.toHaveBeenCalled();
    });

    it("handles missing organizationId in metadata", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockDb.billingEvent.findUnique.mockResolvedValue(null);

      const event = createMockEvent("checkout.session.completed", {
        ...mockSession,
        metadata: {},
      });
      await handleCheckoutCompleted(event);

      expect(mockDb.organization.update).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No organizationId"),
        expect.any(String)
      );
      consoleSpy.mockRestore();
    });

    it("logs billing event on success", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue(null);
      mockDb.organization.update.mockResolvedValue({} as never);
      mockDb.usageRecord.upsert.mockResolvedValue({} as never);
      mockDb.billingEvent.create.mockResolvedValue({} as never);

      const event = createMockEvent(
        "checkout.session.completed",
        mockSession,
        "evt_checkout_1"
      );
      await handleCheckoutCompleted(event);

      expect(mockDb.billingEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: "org_123",
          eventType: "checkout_completed",
          stripeEventId: "evt_checkout_1",
        }),
      });
    });
  });

  describe("handlePaymentSucceeded", () => {
    const mockInvoice = {
      id: "in_123",
      subscription: "sub_123",
      amount_paid: 9900,
      currency: "usd",
    };

    it("updates subscription status to active", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue(null);
      mockDb.organization.findFirst.mockResolvedValue({
        id: "org_123",
        stripeSubscriptionId: "sub_123",
      } as never);
      mockDb.organization.update.mockResolvedValue({} as never);
      mockDb.billingEvent.create.mockResolvedValue({} as never);

      const event = createMockEvent("invoice.payment_succeeded", mockInvoice);
      await handlePaymentSucceeded(event);

      expect(mockDb.organization.update).toHaveBeenCalledWith({
        where: { id: "org_123" },
        data: { subscriptionStatus: "active" },
      });
    });

    it("skips duplicate events (idempotency)", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue({
        id: "be_1",
        stripeEventId: "evt_test_123",
        organizationId: "org_1",
        eventType: "payment_succeeded",
        metadata: null,
        createdAt: new Date(),
      });

      const event = createMockEvent("invoice.payment_succeeded", mockInvoice);
      await handlePaymentSucceeded(event);

      expect(mockDb.organization.findFirst).not.toHaveBeenCalled();
    });

    it("skips non-subscription invoices", async () => {
      const event = createMockEvent("invoice.payment_succeeded", {
        ...mockInvoice,
        subscription: null,
      });
      await handlePaymentSucceeded(event);

      expect(mockDb.billingEvent.findUnique).not.toHaveBeenCalled();
    });

    it("handles missing organization", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockDb.billingEvent.findUnique.mockResolvedValue(null);
      mockDb.organization.findFirst.mockResolvedValue(null);

      const event = createMockEvent("invoice.payment_succeeded", mockInvoice);
      await handlePaymentSucceeded(event);

      expect(mockDb.organization.update).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No organization found"),
        expect.any(String)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("handlePaymentFailed", () => {
    const mockInvoice = {
      id: "in_123",
      subscription: "sub_123",
      attempt_count: 1,
      last_finalization_error: { message: "Card declined" },
      next_payment_attempt: Date.now() / 1000 + 86400,
    };

    it("updates subscription status to past_due", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue(null);
      mockDb.organization.findFirst.mockResolvedValue({
        id: "org_123",
        stripeSubscriptionId: "sub_123",
      } as never);
      mockDb.organization.update.mockResolvedValue({} as never);
      mockDb.billingEvent.create.mockResolvedValue({} as never);

      const event = createMockEvent("invoice.payment_failed", mockInvoice);
      await handlePaymentFailed(event);

      expect(mockDb.organization.update).toHaveBeenCalledWith({
        where: { id: "org_123" },
        data: { subscriptionStatus: "past_due" },
      });
    });

    it("skips duplicate events (idempotency)", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue({
        id: "be_1",
        stripeEventId: "evt_test_123",
        organizationId: "org_1",
        eventType: "payment_failed",
        metadata: null,
        createdAt: new Date(),
      });

      const event = createMockEvent("invoice.payment_failed", mockInvoice);
      await handlePaymentFailed(event);

      expect(mockDb.organization.findFirst).not.toHaveBeenCalled();
    });

    it("logs payment failure details", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue(null);
      mockDb.organization.findFirst.mockResolvedValue({
        id: "org_123",
        stripeSubscriptionId: "sub_123",
      } as never);
      mockDb.organization.update.mockResolvedValue({} as never);
      mockDb.billingEvent.create.mockResolvedValue({} as never);

      const event = createMockEvent("invoice.payment_failed", mockInvoice);
      await handlePaymentFailed(event);

      expect(mockDb.billingEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: "payment_failed",
          metadata: expect.objectContaining({
            attemptCount: 1,
            lastError: "Card declined",
          }),
        }),
      });
    });
  });

  describe("handleSubscriptionUpdated", () => {
    const mockSubscription = {
      id: "sub_123",
      status: "active",
      current_period_end: Date.now() / 1000 + 2592000, // 30 days
      cancel_at_period_end: false,
      metadata: { organizationId: "org_123" },
    };

    it("updates organization subscription details", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue(null);
      mockDb.organization.findFirst.mockResolvedValue({
        id: "org_123",
        stripeSubscriptionId: "sub_123",
      } as never);
      mockDb.organization.update.mockResolvedValue({} as never);
      mockDb.billingEvent.create.mockResolvedValue({} as never);

      const event = createMockEvent(
        "customer.subscription.updated",
        mockSubscription
      );
      await handleSubscriptionUpdated(event);

      expect(mockDb.organization.update).toHaveBeenCalledWith({
        where: { id: "org_123" },
        data: expect.objectContaining({
          stripeSubscriptionId: "sub_123",
          subscriptionStatus: "active",
          currentPeriodEnd: expect.any(Date),
        }),
      });
    });

    it("finds organization by metadata if not by subscription ID", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue(null);
      mockDb.organization.findFirst.mockResolvedValue(null); // Not found by sub ID
      mockDb.organization.findUnique.mockResolvedValue({
        id: "org_123",
        stripeSubscriptionId: null,
      } as never);
      mockDb.organization.update.mockResolvedValue({} as never);
      mockDb.billingEvent.create.mockResolvedValue({} as never);

      const event = createMockEvent(
        "customer.subscription.updated",
        mockSubscription
      );
      await handleSubscriptionUpdated(event);

      expect(mockDb.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "org_123" },
      });
      expect(mockDb.organization.update).toHaveBeenCalled();
    });

    it("skips duplicate events (idempotency)", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue({
        id: "be_1",
        stripeEventId: "evt_test_123",
        organizationId: "org_1",
        eventType: "subscription_updated",
        metadata: null,
        createdAt: new Date(),
      });

      const event = createMockEvent(
        "customer.subscription.updated",
        mockSubscription
      );
      await handleSubscriptionUpdated(event);

      expect(mockDb.organization.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("handleSubscriptionDeleted", () => {
    const mockSubscription = {
      id: "sub_123",
      status: "canceled",
    };

    it("downgrades organization to free plan", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue(null);
      mockDb.organization.findFirst.mockResolvedValue({
        id: "org_123",
        plan: "pro",
        stripeSubscriptionId: "sub_123",
      } as never);
      mockDb.organization.update.mockResolvedValue({} as never);
      mockDb.billingEvent.create.mockResolvedValue({} as never);

      const event = createMockEvent(
        "customer.subscription.deleted",
        mockSubscription
      );
      await handleSubscriptionDeleted(event);

      expect(mockDb.organization.update).toHaveBeenCalledWith({
        where: { id: "org_123" },
        data: {
          plan: "free",
          subscriptionStatus: "canceled",
          stripeSubscriptionId: null,
          currentPeriodEnd: null,
        },
      });
    });

    it("skips duplicate events (idempotency)", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue({
        id: "be_1",
        stripeEventId: "evt_test_123",
        organizationId: "org_1",
        eventType: "subscription_canceled",
        metadata: null,
        createdAt: new Date(),
      });

      const event = createMockEvent(
        "customer.subscription.deleted",
        mockSubscription
      );
      await handleSubscriptionDeleted(event);

      expect(mockDb.organization.findFirst).not.toHaveBeenCalled();
    });

    it("logs cancellation with previous plan", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue(null);
      mockDb.organization.findFirst.mockResolvedValue({
        id: "org_123",
        plan: "pro",
        stripeSubscriptionId: "sub_123",
      } as never);
      mockDb.organization.update.mockResolvedValue({} as never);
      mockDb.billingEvent.create.mockResolvedValue({} as never);

      const event = createMockEvent(
        "customer.subscription.deleted",
        mockSubscription
      );
      await handleSubscriptionDeleted(event);

      expect(mockDb.billingEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: "subscription_canceled",
          metadata: expect.objectContaining({
            previousPlan: "pro",
          }),
        }),
      });
    });
  });

  describe("processWebhookEvent", () => {
    it("routes checkout.session.completed to handler", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue(null);
      mockDb.organization.update.mockResolvedValue({} as never);
      mockDb.usageRecord.upsert.mockResolvedValue({} as never);
      mockDb.billingEvent.create.mockResolvedValue({} as never);

      const event = createMockEvent("checkout.session.completed", {
        id: "cs_123",
        subscription: "sub_123",
        customer: "cus_123",
        metadata: { organizationId: "org_123" },
      });
      await processWebhookEvent(event);

      expect(mockDb.organization.update).toHaveBeenCalled();
    });

    it("routes invoice.payment_failed to handler", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue(null);
      mockDb.organization.findFirst.mockResolvedValue({
        id: "org_123",
        stripeSubscriptionId: "sub_123",
      } as never);
      mockDb.organization.update.mockResolvedValue({} as never);
      mockDb.billingEvent.create.mockResolvedValue({} as never);

      const event = createMockEvent("invoice.payment_failed", {
        id: "in_123",
        subscription: "sub_123",
        attempt_count: 1,
      });
      await processWebhookEvent(event);

      expect(mockDb.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { subscriptionStatus: "past_due" },
        })
      );
    });

    it("routes customer.subscription.deleted to handler", async () => {
      mockDb.billingEvent.findUnique.mockResolvedValue(null);
      mockDb.organization.findFirst.mockResolvedValue({
        id: "org_123",
        plan: "pro",
        stripeSubscriptionId: "sub_123",
      } as never);
      mockDb.organization.update.mockResolvedValue({} as never);
      mockDb.billingEvent.create.mockResolvedValue({} as never);

      const event = createMockEvent("customer.subscription.deleted", {
        id: "sub_123",
        status: "canceled",
      });
      await processWebhookEvent(event);

      expect(mockDb.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            plan: "free",
            subscriptionStatus: "canceled",
          }),
        })
      );
    });

    it("logs unhandled event types", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const event = createMockEvent("unhandled.event.type", {});
      await processWebhookEvent(event);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Unhandled event type:",
        "unhandled.event.type"
      );
      consoleSpy.mockRestore();
    });
  });
});
