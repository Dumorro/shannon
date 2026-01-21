"use client";

import { useState, useEffect } from "react";
import { GitBranch, Loader2, AlertCircle, CheckCircle, XCircle } from "lucide-react";

interface DefaultRepositoryFormProps {
  projectId: string;
  initialDefaultRepositoryUrl?: string | null;
  initialDefaultRepositoryBranch?: string | null;
}

/**
 * T070: DefaultRepositoryForm component for project-level defaults
 * User Story 3: Multi-Repository Projects
 *
 * Allows setting default repository URL and branch for new scans
 */
export function DefaultRepositoryForm({
  projectId,
  initialDefaultRepositoryUrl,
  initialDefaultRepositoryBranch,
}: DefaultRepositoryFormProps) {
  const [defaultRepositoryUrl, setDefaultRepositoryUrl] = useState(
    initialDefaultRepositoryUrl || ""
  );
  const [defaultRepositoryBranch, setDefaultRepositoryBranch] = useState(
    initialDefaultRepositoryBranch || ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    status: "valid" | "invalid" | "untested" | null;
    message?: string;
  }>({ status: null });
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // T071: Check credential connection status when URL changes
  useEffect(() => {
    if (defaultRepositoryUrl && defaultRepositoryUrl !== initialDefaultRepositoryUrl) {
      // Debounce validation
      const timer = setTimeout(() => {
        checkCredentialConnection();
      }, 1000);
      return () => clearTimeout(timer);
    } else if (!defaultRepositoryUrl) {
      setValidationStatus({ status: null });
    }
  }, [defaultRepositoryUrl, initialDefaultRepositoryUrl]);

  // T071: Check if credentials exist for the repository URL
  const checkCredentialConnection = async () => {
    if (!defaultRepositoryUrl) {
      setValidationStatus({ status: null });
      return;
    }

    setValidating(true);
    try {
      const response = await fetch("/api/repository-credentials");
      if (response.ok) {
        const data = await response.json();
        const matchingCredential = data.credentials.find(
          (cred: any) => cred.repositoryUrl === defaultRepositoryUrl
        );

        if (matchingCredential) {
          if (matchingCredential.validationStatus === "valid") {
            setValidationStatus({
              status: "valid",
              message: "Valid credential found for this repository",
            });
          } else if (matchingCredential.validationStatus === "invalid") {
            setValidationStatus({
              status: "invalid",
              message: "Credential found but validation failed",
            });
          } else {
            setValidationStatus({
              status: "untested",
              message: "Credential found but not yet tested",
            });
          }
        } else {
          setValidationStatus({
            status: null,
            message: "No credential configured for this repository",
          });
        }
      }
    } catch (error) {
      console.error("Failed to check credentials:", error);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultRepositoryUrl: defaultRepositoryUrl || null,
          defaultRepositoryBranch: defaultRepositoryBranch || null,
        }),
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Default repository settings updated successfully",
        });
      } else {
        const error = await response.json();
        setMessage({
          type: "error",
          text: error.error || "Failed to update settings",
        });
      }
    } catch (error) {
      console.error("Error updating project:", error);
      setMessage({
        type: "error",
        text: "Failed to update settings",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    setDefaultRepositoryUrl("");
    setDefaultRepositoryBranch("");
    setValidationStatus({ status: null });
  };

  // T071: Render credential connection status
  const renderConnectionStatus = () => {
    if (validating) {
      return (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Checking credentials...</span>
        </div>
      );
    }

    if (!defaultRepositoryUrl) {
      return null;
    }

    if (validationStatus.status === "valid") {
      return (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle className="h-4 w-4" />
          <span>{validationStatus.message}</span>
        </div>
      );
    } else if (validationStatus.status === "invalid") {
      return (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <XCircle className="h-4 w-4" />
          <span>{validationStatus.message}</span>
        </div>
      );
    } else if (validationStatus.status === "untested") {
      return (
        <div className="flex items-center gap-2 text-yellow-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{validationStatus.message}</span>
        </div>
      );
    } else if (validationStatus.message) {
      return (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{validationStatus.message}</span>
        </div>
      );
    }

    return null;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-2 text-gray-700">
        <GitBranch className="h-5 w-5" />
        <h3 className="text-lg font-medium">Default Repository Settings</h3>
      </div>

      <p className="text-sm text-gray-600">
        Set default repository URL and branch for new scans. These values will be
        pre-filled in the scan creation form but can be overridden per scan.
      </p>

      {message && (
        <div
          className={`rounded-md p-3 ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            <span className="text-sm">{message.text}</span>
          </div>
        </div>
      )}

      {/* Default Repository URL */}
      <div>
        <label
          htmlFor="defaultRepositoryUrl"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Default Repository URL
        </label>
        <input
          type="text"
          id="defaultRepositoryUrl"
          value={defaultRepositoryUrl}
          onChange={(e) => setDefaultRepositoryUrl(e.target.value)}
          placeholder="https://github.com/owner/repo or git@github.com:owner/repo.git"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {/* T071: Credential connection status */}
        <div className="mt-2">{renderConnectionStatus()}</div>
      </div>

      {/* Default Repository Branch */}
      <div>
        <label
          htmlFor="defaultRepositoryBranch"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Default Branch
        </label>
        <input
          type="text"
          id="defaultRepositoryBranch"
          value={defaultRepositoryBranch}
          onChange={(e) => setDefaultRepositoryBranch(e.target.value)}
          placeholder="main"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Leave empty to use the repository's default branch
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <button
          type="button"
          onClick={handleClear}
          disabled={!defaultRepositoryUrl && !defaultRepositoryBranch}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear Defaults
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Settings
        </button>
      </div>
    </form>
  );
}
