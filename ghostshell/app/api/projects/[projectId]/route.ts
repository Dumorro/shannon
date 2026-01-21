import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizeRepoUrl } from "@/lib/git/normalize";
import { validateRepositoryUrl } from "@/lib/git/validation";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * GET /api/projects/[projectId] - Get project details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user || user.memberships.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }

    const { projectId } = await params;
    const orgId = user.memberships[0].organizationId;

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        organizationId: orgId,
      },
      include: {
        scans: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            status: true,
            source: true,
            startedAt: true,
            completedAt: true,
            durationMs: true,
            findingsCount: true,
            criticalCount: true,
            highCount: true,
            mediumCount: true,
            lowCount: true,
            createdAt: true,
          },
        },
        authenticationConfig: {
          select: {
            method: true,
            validationStatus: true,
          },
        },
        _count: {
          select: { scans: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const recentScans = project.scans.map((scan) => ({
      id: scan.id,
      projectId: project.id,
      projectName: project.name,
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
    }));

    return NextResponse.json({
      id: project.id,
      name: project.name,
      description: project.description,
      targetUrl: project.targetUrl,
      repositoryUrl: project.repositoryUrl,
      // T063: Include default repository settings
      defaultRepositoryUrl: project.defaultRepositoryUrl,
      defaultRepositoryBranch: project.defaultRepositoryBranch,
      hasAuthConfig: !!project.authenticationConfig,
      authMethod: project.authenticationConfig?.method || null,
      authValidationStatus: project.authenticationConfig?.validationStatus || null,
      schedulesCount: 0, // Will be updated in US4
      lastScanAt: project.scans[0]?.createdAt || null,
      scansCount: project._count.scans,
      createdAt: project.createdAt,
      recentScans,
      schedules: [], // Will be populated in US4
    });
  } catch (error) {
    console.error("Error getting project:", error);
    return NextResponse.json(
      { error: "Failed to get project" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[projectId] - Update project (including default repository settings)
 * T063: Accept defaultRepositoryUrl and defaultRepositoryBranch
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user || user.memberships.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }

    const { projectId } = await params;
    const orgId = user.memberships[0].organizationId;

    // Verify project exists and belongs to organization
    const existingProject = await db.project.findFirst({
      where: {
        id: projectId,
        organizationId: orgId,
      },
    });

    if (!existingProject) {
      return NextResponse.json(
        { error: "Project not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      targetUrl,
      defaultRepositoryUrl,
      defaultRepositoryBranch,
    } = body;

    // T063: Validate repository URL if provided
    if (defaultRepositoryUrl !== undefined && defaultRepositoryUrl !== null) {
      const validation = validateRepositoryUrl(defaultRepositoryUrl);
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: validation.error || "Invalid repository URL",
            code: "INVALID_REPOSITORY_URL",
          },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (targetUrl !== undefined) updateData.targetUrl = targetUrl;

    // T063: Update default repository fields
    if (defaultRepositoryUrl !== undefined) {
      updateData.defaultRepositoryUrl = defaultRepositoryUrl
        ? normalizeRepoUrl(defaultRepositoryUrl)
        : null;
    }
    if (defaultRepositoryBranch !== undefined) {
      updateData.defaultRepositoryBranch = defaultRepositoryBranch || null;
    }

    const updatedProject = await db.project.update({
      where: { id: projectId },
      data: updateData,
    });

    return NextResponse.json({
      id: updatedProject.id,
      name: updatedProject.name,
      description: updatedProject.description,
      targetUrl: updatedProject.targetUrl,
      defaultRepositoryUrl: updatedProject.defaultRepositoryUrl,
      defaultRepositoryBranch: updatedProject.defaultRepositoryBranch,
      createdAt: updatedProject.createdAt,
      updatedAt: updatedProject.updatedAt,
    });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}
