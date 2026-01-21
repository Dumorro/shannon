import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { encryptCredential } from "@/lib/git/encryption";
import { validateRepositoryUrl } from "@/lib/git/validation";
import { normalizeRepoUrl } from "@/lib/git/normalize";
import { createAuditLog } from "@/lib/audit";
import type { CredentialType } from "@prisma/client";

/**
 * GET /api/repository-credentials - List repository credentials
 *
 * Returns all repository credentials for the current organization.
 * Credentials are never decrypted in responses.
 */
export async function GET() {
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
      return NextResponse.json({ credentials: [] });
    }

    const orgId = user.memberships[0].organizationId;

    // Fetch all credentials for the organization (without decrypted secrets)
    const credentials = await db.repositoryCredentials.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
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

    return NextResponse.json({ credentials });
  } catch (error) {
    console.error("Error fetching repository credentials:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/repository-credentials - Create repository credential
 *
 * Creates a new repository credential for the current organization.
 * Credentials are encrypted before storage using AES-256-GCM.
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

    const user = await getCurrentUser();
    if (!user || user.memberships.length === 0) {
      return NextResponse.json(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const orgId = user.memberships[0].organizationId;

    // Parse request body
    const body = await request.json();
    const { repositoryUrl, credentialType, credential } = body;

    // Validate required fields
    if (!repositoryUrl || !credentialType || !credential) {
      return NextResponse.json(
        { error: "Missing required fields: repositoryUrl, credentialType, credential", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Validate credential type
    if (!["PAT", "SSH"].includes(credentialType)) {
      return NextResponse.json(
        { error: "Invalid credentialType. Must be 'PAT' or 'SSH'", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Validate repository URL format
    const urlValidation = validateRepositoryUrl(repositoryUrl);
    if (!urlValidation.valid) {
      return NextResponse.json(
        { error: urlValidation.error, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Normalize repository URL (remove .git suffix, trailing slash)
    const normalizedUrl = normalizeRepoUrl(repositoryUrl);

    // Check if credential already exists for this repository URL
    const existing = await db.repositoryCredentials.findUnique({
      where: {
        organizationId_repositoryUrl: {
          organizationId: orgId,
          repositoryUrl: normalizedUrl,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Credential already exists for this repository URL", code: "DUPLICATE_CREDENTIAL" },
        { status: 409 }
      );
    }

    // Encrypt the credential
    const encryptedCredential = encryptCredential(credential, orgId);

    // Create credential record
    const newCredential = await db.repositoryCredentials.create({
      data: {
        organizationId: orgId,
        repositoryUrl: normalizedUrl,
        credentialType: credentialType as CredentialType,
        encryptedCredential,
        createdBy: user.id,
        validationStatus: "untested",
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

    // T079: Audit log credential creation
    await createAuditLog({
      organizationId: orgId,
      userId: user.id,
      action: "credential.created",
      resourceType: "repository_credential",
      resourceId: newCredential.id,
      metadata: {
        repositoryUrl: normalizedUrl,
        credentialType,
      },
    });

    return NextResponse.json(newCredential, { status: 201 });
  } catch (error) {
    console.error("Error creating repository credential:", error);
    return NextResponse.json(
      { error: "Failed to create credential", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
