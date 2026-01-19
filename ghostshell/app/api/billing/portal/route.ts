import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPortalSessionAction } from "@/lib/actions/billing";

/**
 * POST /api/billing/portal - Create a Stripe Customer Portal session
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
    const { organizationId, returnUrl } = body;

    // Validation
    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json(
        { error: "Organization ID is required", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const session = await createPortalSessionAction({
      organizationId,
      returnUrl,
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("Error creating portal session:", error);

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
      if (error.message.includes("No billing account")) {
        return NextResponse.json(
          { error: error.message, code: "NO_SUBSCRIPTION" },
          { status: 400 }
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
      { error: "Failed to create portal session", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
