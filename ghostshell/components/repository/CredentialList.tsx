"use client";

import { useState } from "react";
import { Key, Trash2, Edit, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { CredentialType } from "@prisma/client";

interface Credential {
  id: string;
  repositoryUrl: string;
  credentialType: CredentialType;
  validationStatus: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
  usageCount?: number; // T068: Will be populated for deletion checks
}

interface CredentialListProps {
  credentials: Credential[];
  onEdit?: (credentialId: string) => void;
  onDelete?: (credentialId: string) => void;
  onRefresh?: () => void;
}

/**
 * T064: CredentialList component to display all org credentials
 * User Story 3: Multi-Repository Projects
 *
 * Displays repository credentials with validation status and usage information
 */
export function CredentialList({
  credentials,
  onEdit,
  onDelete,
  onRefresh,
}: CredentialListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (credentialId: string) => {
    if (!confirm("Are you sure you want to delete this credential?")) {
      return;
    }

    setDeletingId(credentialId);
    try {
      const response = await fetch(
        `/api/repository-credentials/${credentialId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        onRefresh?.();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete credential");
      }
    } catch (error) {
      console.error("Failed to delete credential:", error);
      alert("Failed to delete credential");
    } finally {
      setDeletingId(null);
    }
  };

  // T067: Render validation status indicator
  const renderValidationStatus = (status: string | null) => {
    if (status === "valid") {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm">Valid</span>
        </div>
      );
    } else if (status === "invalid") {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <XCircle className="h-4 w-4" />
          <span className="text-sm">Invalid</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-gray-500">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Untested</span>
        </div>
      );
    }
  };

  if (credentials.length === 0) {
    return (
      <div className="text-center py-12 border border-gray-200 rounded-lg bg-gray-50">
        <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No credentials yet
        </h3>
        <p className="text-gray-600">
          Add a repository credential to start scanning private repositories
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {credentials.map((credential) => (
        <div
          key={credential.id}
          className="border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {/* Repository URL */}
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-gray-400" />
                <span className="font-mono text-sm font-medium text-gray-900">
                  {credential.repositoryUrl}
                </span>
              </div>

              {/* Credential type and validation status */}
              <div className="mt-2 flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  Type:{" "}
                  <span className="font-medium">
                    {credential.credentialType === "PAT"
                      ? "Personal Access Token"
                      : "SSH Key"}
                  </span>
                </div>
                {/* T067: Validation status indicator */}
                {renderValidationStatus(credential.validationStatus)}
              </div>

              {/* Last validated and usage info */}
              <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                {credential.lastValidatedAt && (
                  <span>
                    Last validated:{" "}
                    {new Date(credential.lastValidatedAt).toLocaleDateString()}
                  </span>
                )}
                {/* T068: Usage count indicator */}
                {credential.usageCount !== undefined && (
                  <span>
                    Used in {credential.usageCount}{" "}
                    {credential.usageCount === 1 ? "scan" : "scans"}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(credential.id)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded"
                  title="Edit credential"
                >
                  <Edit className="h-4 w-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => handleDelete(credential.id)}
                  disabled={deletingId === credential.id}
                  className="p-2 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                  title={
                    credential.usageCount && credential.usageCount > 0
                      ? `Used in ${credential.usageCount} scans`
                      : "Delete credential"
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
