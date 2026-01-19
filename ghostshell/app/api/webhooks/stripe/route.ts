import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/billing/stripe-client";
import { processWebhookEvent } from "@/lib/billing/webhook-handlers";

/**
 * POST /api/webhooks/stripe - Handle Stripe webhook events
 *
 * This endpoint receives webhook events from Stripe and processes them
 * to keep the application in sync with subscription state.
 *
 * Verifies webhook signatures to ensure requests are from Stripe.
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const body = await request.text();

    // Get the Stripe signature header
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      console.error("Missing stripe-signature header");
      return NextResponse.json(
        { error: "Missing signature", code: "MISSING_SIGNATURE" },
        { status: 400 }
      );
    }

    // Verify and construct the event
    let event;
    try {
      event = constructWebhookEvent(body, signature);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Webhook signature verification failed:", errorMessage);
      return NextResponse.json(
        { error: "Invalid signature", code: "INVALID_SIGNATURE" },
        { status: 401 }
      );
    }

    // Process the event
    try {
      await processWebhookEvent(event);
    } catch (err) {
      // Log the error but return 200 to acknowledge receipt
      // Stripe will retry failed webhooks, but we don't want to retry
      // if our handler has a bug
      console.error("Error processing webhook event:", err);
      console.error("Event ID:", event.id, "Type:", event.type);

      // Return 200 to acknowledge receipt even if processing fails
      // This prevents Stripe from retrying indefinitely
      // The event is logged and can be investigated
      return NextResponse.json(
        { received: true, processed: false, error: "Processing failed" },
        { status: 200 }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
