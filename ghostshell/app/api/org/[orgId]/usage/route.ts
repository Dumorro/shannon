import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getUsageStats } from "@/lib/billing/usage-tracker";

/**
 * GET /api/org/[orgId]/usage - Get usage statistics for an organization
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

    // Get usage statistics
    const stats = await getUsageStats(orgId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage data", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
