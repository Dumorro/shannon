import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { decryptCredential } from "@/lib/git/encryption";
import { validateRepositoryAccess } from "@/lib/git/validate-access";
import type { CredentialType } from "@prisma/client";

/**
 * POST /api/repository-credentials/validate - Validate repository access
 *
 * Tests if credentials can access the specified repository.
 * Can validate either:
 * 1. An existing stored credential (provide credentialId)
 * 2. A new credential before storing (provide credential data)
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
    const { repositoryUrl, credentialId, credential } = body;

    // Validate required fields
    if (!repositoryUrl) {
      return NextResponse.json(
        { error: "Missing required field: repositoryUrl", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Determine credential source
    let credentialType: CredentialType;
    let decryptedCredential: string;

    if (credentialId) {
      // Validate using stored credential
      const storedCred = await db.repositoryCredentials.findFirst({
        where: {
          id: credentialId,
          organizationId: orgId,
        },
      });

      if (!storedCred) {
        return NextResponse.json(
          { error: "Credential not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      credentialType = storedCred.credentialType;
      decryptedCredential = decryptCredential(storedCred.encryptedCredential, orgId);
    } else if (credential) {
      // Validate using provided credential (before storing)
      if (!credential.type) {
        return NextResponse.json(
          { error: "Missing credential.type ('PAT' or 'SSH')", code: "VALIDATION_ERROR" },
          { status: 400 }
        );
      }

      if (!["PAT", "SSH"].includes(credential.type)) {
        return NextResponse.json(
          { error: "Invalid credential.type. Must be 'PAT' or 'SSH'", code: "VALIDATION_ERROR" },
          { status: 400 }
        );
      }

      credentialType = credential.type as CredentialType;

      // Extract credential string based on type
      if (credentialType === "PAT") {
        if (!credential.token) {
          return NextResponse.json(
            { error: "Missing credential.token for PAT type", code: "VALIDATION_ERROR" },
            { status: 400 }
          );
        }
        decryptedCredential = credential.token;
      } else {
        // SSH
        if (!credential.privateKey) {
          return NextResponse.json(
            { error: "Missing credential.privateKey for SSH type", code: "VALIDATION_ERROR" },
            { status: 400 }
          );
        }
        decryptedCredential = credential.privateKey;
      }
    } else {
      return NextResponse.json(
        { error: "Must provide either credentialId or credential", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Perform validation using git ls-remote
    const validationResult = await validateRepositoryAccess(
      repositoryUrl,
      credentialType,
      decryptedCredential
    );

    // If validating a stored credential, update validation status
    if (credentialId && validationResult.valid) {
      await db.repositoryCredentials.update({
        where: { id: credentialId },
        data: {
          validationStatus: "valid",
          lastValidatedAt: new Date(),
        },
      });
    } else if (credentialId && !validationResult.valid) {
      await db.repositoryCredentials.update({
        where: { id: credentialId },
        data: {
          validationStatus: "invalid",
          lastValidatedAt: new Date(),
        },
      });
    }

    // Return validation result
    return NextResponse.json({
      valid: validationResult.valid,
      error: validationResult.error,
      errorMessage: validationResult.errorMessage,
      branches: validationResult.branches,
      defaultBranch: validationResult.defaultBranch,
      duration: validationResult.duration,
    });
  } catch (error) {
    console.error("Error validating repository access:", error);
    return NextResponse.json(
      { error: "Validation failed", code: "INTERNAL_ERROR", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
