import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createCheckoutSessionAction } from "@/lib/actions/billing";
import type { BillingInterval } from "@/lib/billing/types";

/**
 * POST /api/billing/checkout - Create a Stripe checkout session
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { organizationId, plan, interval, successUrl, cancelUrl } = body;

    // Validation
    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json(
        { error: "Organization ID is required", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    if (plan !== "pro") {
      return NextResponse.json(
        { error: "Invalid plan. Only 'pro' plan can be purchased via checkout.", code: "INVALID_PLAN" },
        { status: 400 }
      );
    }

    if (interval !== "monthly" && interval !== "annual") {
      return NextResponse.json(
        { error: "Invalid interval. Must be 'monthly' or 'annual'.", code: "INVALID_INTERVAL" },
        { status: 400 }
      );
    }

    const session = await createCheckoutSessionAction({
      organizationId,
      plan,
      interval: interval as BillingInterval,
      successUrl,
      cancelUrl,
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("Error creating checkout session:", error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === "Not authorized to manage billing") {
        return NextResponse.json(
          { error: "You do not have permission to manage billing", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
      if (error.message === "Organization not found") {
        return NextResponse.json(
          { error: "Organization not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }
      if (error.message === "Price not configured") {
        return NextResponse.json(
          { error: "Billing is not configured. Please contact support.", code: "CONFIGURATION_ERROR" },
          { status: 500 }
        );
      }
    }

    // Check if it's a Stripe error
    if (error && typeof error === "object" && "type" in error) {
      return NextResponse.json(
        {
          error: "Payment service is temporarily unavailable. Please try again later.",
          code: "STRIPE_ERROR",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create checkout session", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
