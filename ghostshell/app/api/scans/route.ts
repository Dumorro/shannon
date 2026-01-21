import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { startScanWorkflow } from "@/lib/temporal/client";
import { checkConcurrentLimit } from "@/lib/scan-queue";
import { decryptCredential } from "@/lib/git/encryption";
import { normalizeRepoUrl } from "@/lib/git/normalize";
import type { ScanStatus } from "@prisma/client";

/**
 * GET /api/scans - List scans for organization
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user || user.memberships.length === 0) {
      return NextResponse.json({ scans: [], nextCursor: null, total: 0 });
    }

    const orgId = user.memberships[0].organizationId;
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const projectId = searchParams.get("projectId");
    const statusParam = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const repositoryUrl = searchParams.get("repositoryUrl"); // T052
    const repositoryBranch = searchParams.get("repositoryBranch"); // T053
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    // Build where clause
    const where: {
      organizationId: string;
      projectId?: string;
      status?: { in: ScanStatus[] };
      createdAt?: { gte?: Date; lte?: Date };
      repositoryUrl?: string;
      repositoryBranch?: string;
    } = {
      organizationId: orgId,
    };

    if (projectId) {
      where.projectId = projectId;
    }

    if (statusParam) {
      const statuses = statusParam.split(",") as ScanStatus[];
      where.status = { in: statuses };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // T052: Filter by repository URL
    if (repositoryUrl) {
      where.repositoryUrl = normalizeRepoUrl(repositoryUrl);
    }

    // T053: Filter by repository branch
    if (repositoryBranch) {
      where.repositoryBranch = repositoryBranch;
    }

    // Count total
    const total = await db.scan.count({ where });

    // Fetch scans with cursor pagination
    const scans = await db.scan.findMany({
      where: cursor ? { ...where, id: { lt: cursor } } : where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        project: {
          select: { id: true, name: true, targetUrl: true },
        },
      },
    });

    const hasMore = scans.length > limit;
    const results = hasMore ? scans.slice(0, -1) : scans;
    const nextCursor = hasMore ? results[results.length - 1]?.id : null;

    const formattedScans = results.map((scan) => ({
      id: scan.id,
      projectId: scan.projectId,
      projectName: scan.project.name,
      status: scan.status,
      source: scan.source,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      durationMs: scan.durationMs,
      findingsCount: scan.findingsCount,
      criticalCount: scan.criticalCount,
      highCount: scan.highCount,
      mediumCount: scan.mediumCount,
      lowCount: scan.lowCount,
      createdAt: scan.createdAt,
      // T030: Include repository fields in response
      repositoryUrl: scan.repositoryUrl,
      repositoryBranch: scan.repositoryBranch,
      repositoryCommitHash: scan.repositoryCommitHash,
    }));

    return NextResponse.json({
      scans: formattedScans,
      nextCursor,
      total,
    });
  } catch (error) {
    console.error("Error listing scans:", error);
    return NextResponse.json(
      { error: "Failed to list scans", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scans - Start a new scan
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user || user.memberships.length === 0) {
      return NextResponse.json(
        { error: "No organization found", code: "NO_ORGANIZATION" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      projectId,
      targetUrl: targetUrlOverride,
      repositoryUrl: repositoryUrlOverride,
      repositoryBranch: repositoryBranchOverride,
      repositoryCommitHash,
    } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const orgId = user.memberships[0].organizationId;

    // Verify project exists and belongs to org
    const project = await db.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Repository configuration (T031: inherit from project defaults)
    const repositoryUrl = repositoryUrlOverride || project.defaultRepositoryUrl;
    const repositoryBranch = repositoryBranchOverride || project.defaultRepositoryBranch || "main";

    // T032: Credential snapshot - resolve and cache credential at scan creation time
    let decryptedCredential: string | undefined;
    let credentialType: "PAT" | "SSH" | undefined;

    if (repositoryUrl) {
      // Normalize repository URL for lookup
      const normalizedUrl = normalizeRepoUrl(repositoryUrl);

      // Fetch credential from database
      const credential = await db.repositoryCredentials.findFirst({
        where: {
          organizationId: orgId,
          repositoryUrl: normalizedUrl,
        },
      });

      if (credential) {
        // Decrypt credential at scan creation time (snapshot)
        decryptedCredential = decryptCredential(credential.encryptedCredential, orgId);
        credentialType = credential.credentialType;
      } else {
        // No credential found - proceed without repository cloning
        console.warn(`No credential found for repository: ${normalizedUrl}`);
      }
    }

    // Check concurrent scan limit
    const { canStart, currentCount, limit: concurrentLimit } = await checkConcurrentLimit(orgId);
    if (!canStart) {
      return NextResponse.json(
        {
          error: `Concurrent scan limit reached (${currentCount}/${concurrentLimit})`,
          code: "CONCURRENT_LIMIT",
          details: { currentCount, limit: concurrentLimit },
        },
        { status: 403 }
      );
    }

    const targetUrl = targetUrlOverride || project.targetUrl;

    // Create scan record (T029: store repository fields)
    const scan = await db.$transaction(async (tx) => {
      const newScan = await tx.scan.create({
        data: {
          organizationId: orgId,
          projectId: project.id,
          status: "PENDING",
          source: "MANUAL",
          repositoryUrl,
          repositoryBranch,
          repositoryCommitHash,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          action: "scan.started",
          resourceType: "scan",
          resourceId: newScan.id,
          metadata: {
            projectId: project.id,
            projectName: project.name,
            targetUrl,
            repositoryUrl,
            repositoryBranch,
            repositoryCommitHash,
          },
        },
      });

      return newScan;
    });

    // Start Temporal workflow (T032: pass credential snapshot)
    try {
      const { workflowId } = await startScanWorkflow({
        projectId: project.id,
        organizationId: orgId,
        targetUrl,
        repositoryUrl,
        repositoryBranch,
        repositoryCommitHash,
        repositoryCredential: decryptedCredential,
        repositoryCredentialType: credentialType,
        scanId: scan.id,
      });

      // Update scan with workflow ID and set to RUNNING
      await db.scan.update({
        where: { id: scan.id },
        data: {
          temporalWorkflowId: workflowId,
          status: "RUNNING",
          startedAt: new Date(),
        },
      });
    } catch (workflowError) {
      // If workflow fails to start, mark scan as failed
      console.error("Failed to start workflow:", workflowError);
      await db.scan.update({
        where: { id: scan.id },
        data: {
          status: "FAILED",
          errorMessage: "Failed to start scan workflow",
          errorCode: "WORKFLOW_START_FAILED",
        },
      });

      return NextResponse.json(
        { error: "Failed to start scan workflow", code: "WORKFLOW_ERROR" },
        { status: 500 }
      );
    }

    // Fetch updated scan
    const updatedScan = await db.scan.findUnique({
      where: { id: scan.id },
      include: {
        project: {
          select: { name: true, targetUrl: true },
        },
      },
    });

    return NextResponse.json(
      {
        id: updatedScan!.id,
        projectId: updatedScan!.projectId,
        projectName: updatedScan!.project.name,
        status: updatedScan!.status,
        source: updatedScan!.source,
        targetUrl: updatedScan!.project.targetUrl,
        currentPhase: updatedScan!.currentPhase,
        currentAgent: updatedScan!.currentAgent,
        progressPercent: updatedScan!.progressPercent,
        startedAt: updatedScan!.startedAt,
        createdAt: updatedScan!.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error starting scan:", error);
    return NextResponse.json(
      { error: "Failed to start scan", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
