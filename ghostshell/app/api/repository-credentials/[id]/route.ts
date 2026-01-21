import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { encryptCredential } from "@/lib/git/encryption";
import { createAuditLog } from "@/lib/audit";
import type { CredentialType } from "@prisma/client";

/**
 * GET /api/repository-credentials/[id] - Get repository credential
 *
 * Returns a single repository credential (without decrypted secret).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user || user.memberships.length === 0) {
      return NextResponse.json(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const orgId = user.memberships[0].organizationId;
    const { id } = await params;

    // Fetch credential (verify organization ownership)
    const credential = await db.repositoryCredentials.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
      select: {
        id: true,
        repositoryUrl: true,
        credentialType: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        lastValidatedAt: true,
        validationStatus: true,
      },
    });

    if (!credential) {
      return NextResponse.json(
        { error: "Credential not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(credential);
  } catch (error) {
    console.error("Error fetching repository credential:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/repository-credentials/[id] - Update repository credential
 *
 * Updates credential or validation status.
 * Only the credential owner organization can update.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user || user.memberships.length === 0) {
      return NextResponse.json(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const orgId = user.memberships[0].organizationId;
    const { id } = await params;

    // Verify credential exists and belongs to organization
    const existing = await db.repositoryCredentials.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Credential not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { credential, validationStatus } = body;

    // Build update data
    const updateData: {
      encryptedCredential?: string;
      validationStatus?: string;
      updatedAt?: Date;
    } = {
      updatedAt: new Date(),
    };

    // If new credential provided, re-encrypt it
    if (credential !== undefined) {
      if (!credential) {
        return NextResponse.json(
          { error: "Credential cannot be empty", code: "VALIDATION_ERROR" },
          { status: 400 }
        );
      }
      updateData.encryptedCredential = encryptCredential(credential, orgId);
      // Reset validation status when credential changes
      updateData.validationStatus = "untested";
    }

    // Allow manual validation status updates
    if (validationStatus !== undefined) {
      if (!["valid", "invalid", "untested"].includes(validationStatus)) {
        return NextResponse.json(
          { error: "Invalid validationStatus. Must be 'valid', 'invalid', or 'untested'", code: "VALIDATION_ERROR" },
          { status: 400 }
        );
      }
      updateData.validationStatus = validationStatus;
    }

    // Update credential
    const updated = await db.repositoryCredentials.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        repositoryUrl: true,
        credentialType: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        lastValidatedAt: true,
        validationStatus: true,
      },
    });

    // T079: Audit log credential update
    await createAuditLog({
      organizationId: orgId,
      userId: user.id,
      action: "credential.updated",
      resourceType: "repository_credential",
      resourceId: id,
      metadata: {
        repositoryUrl: updated.repositoryUrl,
        credentialType: updated.credentialType,
        credentialChanged: credential !== undefined,
        validationStatusChanged: validationStatus !== undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating repository credential:", error);
    return NextResponse.json(
      { error: "Failed to update credential", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/repository-credentials/[id] - Delete repository credential
 *
 * Removes a repository credential.
 * Only the credential owner organization can delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user || user.memberships.length === 0) {
      return NextResponse.json(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const orgId = user.memberships[0].organizationId;
    const { id } = await params;

    // Verify credential exists and belongs to organization
    const existing = await db.repositoryCredentials.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Credential not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Delete the credential
    await db.repositoryCredentials.delete({
      where: { id },
    });

    // T079: Audit log credential deletion
    await createAuditLog({
      organizationId: orgId,
      userId: user.id,
      action: "credential.deleted",
      resourceType: "repository_credential",
      resourceId: id,
      metadata: {
        repositoryUrl: existing.repositoryUrl,
        credentialType: existing.credentialType,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting repository credential:", error);
    return NextResponse.json(
      { error: "Failed to delete credential", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
