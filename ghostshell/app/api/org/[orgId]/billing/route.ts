import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getPlanLimits } from "@/lib/billing/plan-limits";
import { getUsageStats } from "@/lib/billing/usage-tracker";
import type { PlanType } from "@/lib/billing/types";

/**
 * GET /api/org/[orgId]/billing - Get combined billing information
 *
 * Returns plan details, usage stats, and subscription status in a single request.
 * Requires at least member access to the organization.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { orgId } = await params;

    // Verify user has access to this organization
    const membership = await db.membership.findFirst({
      where: {
        organizationId: orgId,
        userId,
      },
      select: { role: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Organization not found or access denied", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Get organization with billing info
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        billingEmail: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const plan = org.plan as PlanType;
    const limits = getPlanLimits(plan);

    // Get usage stats
    const usageStats = await getUsageStats(orgId);

    // Determine billing access level based on role
    const canManage = membership.role === "owner" || membership.role === "admin";
    const canView = canManage || membership.role === "member";

    // Return combined billing info
    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
      },
      subscription: {
        plan,
        status: org.subscriptionStatus || "inactive",
        currentPeriodEnd: org.currentPeriodEnd,
        billingEmail: canManage ? org.billingEmail : undefined,
        hasStripeAccount: !!org.stripeCustomerId,
      },
      limits: {
        concurrentScans: limits.concurrentScans,
        teamMembers: limits.teamMembers,
        scanDurationMinutes: limits.scanDurationMinutes,
        monthlyTokenAllowance: limits.monthlyTokenAllowance,
        features: limits.features,
      },
      usage: usageStats,
      access: {
        canManage,
        canView,
        role: membership.role,
      },
    });
  } catch (error) {
    console.error("Error fetching billing info:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing information", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
