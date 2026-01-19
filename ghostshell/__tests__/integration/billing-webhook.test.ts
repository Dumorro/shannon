/**
 * Integration tests for Stripe webhook endpoint (Epic 010 - US5)
 * Tests the full webhook request/response cycle including signature verification
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type Stripe from "stripe";

// Mock processWebhookEvent
const mockProcessWebhookEvent = vi.fn();

// Mock constructWebhookEvent - controls signature verification
const mockConstructWebhookEvent = vi.fn();

vi.mock("@/lib/billing/stripe-client", () => ({
  constructWebhookEvent: (...args: unknown[]) => mockConstructWebhookEvent(...args),
}));

vi.mock("@/lib/billing/webhook-handlers", () => ({
  processWebhookEvent: (...args: unknown[]) => mockProcessWebhookEvent(...args),
}));

// Import the route handler after mocks are set up
import { POST } from "@/app/api/webhooks/stripe/route";

// Helper to create a mock NextRequest
function createMockRequest(options: {
  body?: string;
  signature?: string | null;
}): NextRequest {
  const { body = "{}", signature } = options;

  const headers = new Headers();
  if (signature !== null) {
    headers.set("stripe-signature", signature ?? "sig_test_123");
  }

  return new NextRequest("https://example.com/api/webhooks/stripe", {
    method: "POST",
    body,
    headers,
  });
}

// Helper to create a mock Stripe event
function createMockStripeEvent(
  type: string,
  data: Record<string, unknown> = {}
): Stripe.Event {
  return {
    id: `evt_${Date.now()}`,
    type,
    data: { object: data },
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    object: "event",
    pending_webhooks: 0,
    request: null,
  } as Stripe.Event;
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signature validation", () => {
    it("returns 400 when stripe-signature header is missing", async () => {
      const request = createMockRequest({ signature: null });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toEqual({
        error: "Missing signature",
        code: "MISSING_SIGNATURE",
      });
      expect(mockConstructWebhookEvent).not.toHaveBeenCalled();
    });

    it("returns 401 when signature verification fails", async () => {
      mockConstructWebhookEvent.mockImplementation(() => {
        throw new Error("Signature verification failed");
      });

      const request = createMockRequest({
        body: '{"type": "test"}',
        signature: "invalid_signature",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json).toEqual({
        error: "Invalid signature",
        code: "INVALID_SIGNATURE",
      });
    });

    it("verifies signature with correct parameters", async () => {
      const testBody = '{"id": "evt_123", "type": "checkout.session.completed"}';
      const testSignature = "t=1234567890,v1=abc123";

      mockConstructWebhookEvent.mockReturnValue(
        createMockStripeEvent("checkout.session.completed")
      );
      mockProcessWebhookEvent.mockResolvedValue(undefined);

      const request = createMockRequest({
        body: testBody,
        signature: testSignature,
      });

      await POST(request);

      expect(mockConstructWebhookEvent).toHaveBeenCalledWith(
        testBody,
        testSignature
      );
    });
  });

  describe("event processing", () => {
    it("returns 200 with received: true on successful processing", async () => {
      const event = createMockStripeEvent("checkout.session.completed", {
        id: "cs_123",
        subscription: "sub_123",
        customer: "cus_123",
        metadata: { organizationId: "org_123" },
      });

      mockConstructWebhookEvent.mockReturnValue(event);
      mockProcessWebhookEvent.mockResolvedValue(undefined);

      const request = createMockRequest({
        body: JSON.stringify(event),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ received: true });
      expect(mockProcessWebhookEvent).toHaveBeenCalledWith(event);
    });

    it("returns 200 even when processing fails to prevent retries", async () => {
      const event = createMockStripeEvent("invoice.payment_failed", {
        id: "in_123",
        subscription: "sub_123",
      });

      mockConstructWebhookEvent.mockReturnValue(event);
      mockProcessWebhookEvent.mockRejectedValue(new Error("Database error"));

      // Spy on console.error to verify error logging
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const request = createMockRequest({
        body: JSON.stringify(event),
      });

      const response = await POST(request);
      const json = await response.json();

      // Should return 200 to acknowledge receipt
      expect(response.status).toBe(200);
      expect(json).toEqual({
        received: true,
        processed: false,
        error: "Processing failed",
      });

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error processing webhook event:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("processes checkout.session.completed events", async () => {
      const event = createMockStripeEvent("checkout.session.completed", {
        id: "cs_test_123",
        subscription: "sub_123",
        customer: "cus_123",
        metadata: { organizationId: "org_123" },
      });

      mockConstructWebhookEvent.mockReturnValue(event);
      mockProcessWebhookEvent.mockResolvedValue(undefined);

      const request = createMockRequest({
        body: JSON.stringify(event),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockProcessWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "checkout.session.completed",
        })
      );
    });

    it("processes invoice.payment_succeeded events", async () => {
      const event = createMockStripeEvent("invoice.payment_succeeded", {
        id: "in_123",
        subscription: "sub_123",
        amount_paid: 9900,
      });

      mockConstructWebhookEvent.mockReturnValue(event);
      mockProcessWebhookEvent.mockResolvedValue(undefined);

      const request = createMockRequest({
        body: JSON.stringify(event),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockProcessWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "invoice.payment_succeeded",
        })
      );
    });

    it("processes invoice.payment_failed events", async () => {
      const event = createMockStripeEvent("invoice.payment_failed", {
        id: "in_123",
        subscription: "sub_123",
        attempt_count: 1,
      });

      mockConstructWebhookEvent.mockReturnValue(event);
      mockProcessWebhookEvent.mockResolvedValue(undefined);

      const request = createMockRequest({
        body: JSON.stringify(event),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockProcessWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "invoice.payment_failed",
        })
      );
    });

    it("processes customer.subscription.updated events", async () => {
      const event = createMockStripeEvent("customer.subscription.updated", {
        id: "sub_123",
        status: "active",
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
      });

      mockConstructWebhookEvent.mockReturnValue(event);
      mockProcessWebhookEvent.mockResolvedValue(undefined);

      const request = createMockRequest({
        body: JSON.stringify(event),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockProcessWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "customer.subscription.updated",
        })
      );
    });

    it("processes customer.subscription.deleted events", async () => {
      const event = createMockStripeEvent("customer.subscription.deleted", {
        id: "sub_123",
        status: "canceled",
      });

      mockConstructWebhookEvent.mockReturnValue(event);
      mockProcessWebhookEvent.mockResolvedValue(undefined);

      const request = createMockRequest({
        body: JSON.stringify(event),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockProcessWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "customer.subscription.deleted",
        })
      );
    });
  });

  describe("error handling", () => {
    it("returns 500 on unexpected errors during request parsing", async () => {
      // Create a request that will fail during body parsing
      const request = {
        text: () => Promise.reject(new Error("Network error")),
        headers: new Headers({ "stripe-signature": "sig_test" }),
      } as unknown as NextRequest;

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: "Webhook handler failed",
        code: "INTERNAL_ERROR",
      });

      consoleSpy.mockRestore();
    });
  });

  describe("idempotency", () => {
    it("passes the same event for idempotency handling by processWebhookEvent", async () => {
      const eventId = "evt_test_idempotent_123";
      const event = {
        ...createMockStripeEvent("checkout.session.completed"),
        id: eventId,
      };

      mockConstructWebhookEvent.mockReturnValue(event);
      mockProcessWebhookEvent.mockResolvedValue(undefined);

      const request = createMockRequest({
        body: JSON.stringify(event),
      });

      // First request
      await POST(request);

      // Verify the event ID is passed to processWebhookEvent
      // (idempotency is handled by processWebhookEvent internally)
      expect(mockProcessWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: eventId,
        })
      );
    });
  });

  describe("real-world scenarios", () => {
    it("handles complete checkout flow webhook", async () => {
      const checkoutEvent = createMockStripeEvent("checkout.session.completed", {
        id: "cs_test_abc123",
        mode: "subscription",
        subscription: "sub_1234567890",
        customer: "cus_customer123",
        customer_email: "user@example.com",
        metadata: {
          organizationId: "org_test_123",
        },
        payment_status: "paid",
        status: "complete",
      });

      mockConstructWebhookEvent.mockReturnValue(checkoutEvent);
      mockProcessWebhookEvent.mockResolvedValue(undefined);

      const request = createMockRequest({
        body: JSON.stringify(checkoutEvent),
        signature: "t=1234567890,v1=abc123def456",
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockProcessWebhookEvent).toHaveBeenCalledTimes(1);
    });

    it("handles subscription cancellation flow", async () => {
      const cancelEvent = createMockStripeEvent("customer.subscription.deleted", {
        id: "sub_1234567890",
        object: "subscription",
        status: "canceled",
        cancel_at_period_end: false,
        canceled_at: Math.floor(Date.now() / 1000),
        customer: "cus_customer123",
        metadata: {
          organizationId: "org_test_123",
        },
      });

      mockConstructWebhookEvent.mockReturnValue(cancelEvent);
      mockProcessWebhookEvent.mockResolvedValue(undefined);

      const request = createMockRequest({
        body: JSON.stringify(cancelEvent),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockProcessWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "customer.subscription.deleted",
          data: expect.objectContaining({
            object: expect.objectContaining({
              status: "canceled",
            }),
          }),
        })
      );
    });

    it("handles payment failure recovery scenario", async () => {
      // Simulate payment failure
      const failureEvent = createMockStripeEvent("invoice.payment_failed", {
        id: "in_failed_123",
        subscription: "sub_123",
        attempt_count: 1,
        next_payment_attempt: Math.floor(Date.now() / 1000) + 86400,
      });

      mockConstructWebhookEvent.mockReturnValue(failureEvent);
      mockProcessWebhookEvent.mockResolvedValue(undefined);

      const failureRequest = createMockRequest({
        body: JSON.stringify(failureEvent),
      });

      const failureResponse = await POST(failureRequest);
      expect(failureResponse.status).toBe(200);

      // Clear mocks for next call
      vi.clearAllMocks();

      // Simulate payment recovery
      const successEvent = createMockStripeEvent("invoice.payment_succeeded", {
        id: "in_success_123",
        subscription: "sub_123",
        amount_paid: 9900,
      });

      mockConstructWebhookEvent.mockReturnValue(successEvent);
      mockProcessWebhookEvent.mockResolvedValue(undefined);

      const successRequest = createMockRequest({
        body: JSON.stringify(successEvent),
      });

      const successResponse = await POST(successRequest);
      expect(successResponse.status).toBe(200);
    });
  });
});
