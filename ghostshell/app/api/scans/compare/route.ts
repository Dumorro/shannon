import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { findingsDiff, type FindingComparison } from "@/lib/scans/findings-diff";

/**
 * GET /api/scans/compare - Compare findings between two scans
 * Query params: scanA, scanB (scan IDs to compare)
 *
 * Returns:
 * - commonFindings: Present in both scans
 * - onlyInScanA: Only in first scan (branch-specific to A)
 * - onlyInScanB: Only in second scan (branch-specific to B)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user || user.memberships.length === 0) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 }
      );
    }

    const orgId = user.memberships[0].organizationId;
    const searchParams = request.nextUrl.searchParams;

    const scanAId = searchParams.get("scanA");
    const scanBId = searchParams.get("scanB");

    if (!scanAId || !scanBId) {
      return NextResponse.json(
        {
          error: "Both scanA and scanB query parameters are required",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    if (scanAId === scanBId) {
      return NextResponse.json(
        {
          error: "Cannot compare a scan with itself",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    // Fetch both scans with their findings
    const [scanA, scanB] = await Promise.all([
      db.scan.findFirst({
        where: { id: scanAId, organizationId: orgId },
        include: {
          findings: {
            orderBy: { severity: "asc" },
          },
          project: {
            select: { id: true, name: true },
          },
        },
      }),
      db.scan.findFirst({
        where: { id: scanBId, organizationId: orgId },
        include: {
          findings: {
            orderBy: { severity: "asc" },
          },
          project: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    if (!scanA) {
      return NextResponse.json(
        { error: `Scan A (${scanAId}) not found`, code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!scanB) {
      return NextResponse.json(
        { error: `Scan B (${scanBId}) not found`, code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Ensure both scans are completed
    if (scanA.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: `Scan A is not completed (status: ${scanA.status})`,
          code: "INVALID_STATE",
        },
        { status: 400 }
      );
    }

    if (scanB.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: `Scan B is not completed (status: ${scanB.status})`,
          code: "INVALID_STATE",
        },
        { status: 400 }
      );
    }

    // T056: Perform findings diff
    const comparison: FindingComparison = findingsDiff(
      scanA.findings,
      scanB.findings
    );

    return NextResponse.json({
      scanA: {
        id: scanA.id,
        projectId: scanA.projectId,
        projectName: scanA.project.name,
        status: scanA.status,
        repositoryUrl: scanA.repositoryUrl,
        repositoryBranch: scanA.repositoryBranch,
        repositoryCommitHash: scanA.repositoryCommitHash,
        findingsCount: scanA.findingsCount,
        completedAt: scanA.completedAt,
      },
      scanB: {
        id: scanB.id,
        projectId: scanB.projectId,
        projectName: scanB.project.name,
        status: scanB.status,
        repositoryUrl: scanB.repositoryUrl,
        repositoryBranch: scanB.repositoryBranch,
        repositoryCommitHash: scanB.repositoryCommitHash,
        findingsCount: scanB.findingsCount,
        completedAt: scanB.completedAt,
      },
      comparison: {
        commonFindings: comparison.commonFindings,
        onlyInScanA: comparison.onlyInScanA,
        onlyInScanB: comparison.onlyInScanB,
        summary: {
          totalCommon: comparison.commonFindings.length,
          totalOnlyInA: comparison.onlyInScanA.length,
          totalOnlyInB: comparison.onlyInScanB.length,
        },
      },
    });
  } catch (error) {
    console.error("Error comparing scans:", error);
    return NextResponse.json(
      { error: "Failed to compare scans", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
