"use client";

import { useState } from "react";
import { Loader2, Key, AlertCircle, CheckCircle } from "lucide-react";
import type { CredentialType } from "@prisma/client";

interface CredentialFormProps {
  onSuccess?: (credentialId: string) => void;
  onCancel?: () => void;
}

/**
 * T065: CredentialForm component for PAT/SSH credential input with validation
 * User Story 3: Multi-Repository Projects
 *
 * Allows creating repository credentials with validation
 */
export function CredentialForm({ onSuccess, onCancel }: CredentialFormProps) {
  const [credentialType, setCredentialType] = useState<CredentialType>("PAT");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [credential, setCredential] = useState("");
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async () => {
    if (!repositoryUrl || !credential) {
      setError("Please provide both repository URL and credential");
      return;
    }

    setValidating(true);
    setValidationResult(null);
    setError(null);

    try {
      const response = await fetch("/api/repository-credentials/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryUrl,
          credentialType,
          credential,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setValidationResult({
          valid: data.valid,
          message: data.valid
            ? "Credential validated successfully"
            : data.error || "Validation failed",
        });
      } else {
        setError(data.error || "Validation request failed");
      }
    } catch (err) {
      setError("Failed to validate credential");
      console.error("Validation error:", err);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!repositoryUrl || !credential) {
      setError("Please provide both repository URL and credential");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/repository-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryUrl,
          credentialType,
          credential,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess?.(data.id);
      } else {
        setError(data.error || "Failed to create credential");
      }
    } catch (err) {
      setError("Failed to create credential");
      console.error("Create credential error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-2 text-gray-700">
        <Key className="h-5 w-5" />
        <h3 className="text-lg font-medium">Add Repository Credential</h3>
      </div>

      {/* Credential Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Credential Type
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="credentialType"
              value="PAT"
              checked={credentialType === "PAT"}
              onChange={(e) =>
                setCredentialType(e.target.value as CredentialType)
              }
              className="mr-2"
            />
            <span className="text-sm">Personal Access Token (PAT)</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="credentialType"
              value="SSH"
              checked={credentialType === "SSH"}
              onChange={(e) =>
                setCredentialType(e.target.value as CredentialType)
              }
              className="mr-2"
            />
            <span className="text-sm">SSH Private Key</span>
          </label>
        </div>
      </div>

      {/* Repository URL */}
      <div>
        <label
          htmlFor="repositoryUrl"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Repository URL
        </label>
        <input
          type="text"
          id="repositoryUrl"
          value={repositoryUrl}
          onChange={(e) => setRepositoryUrl(e.target.value)}
          placeholder={
            credentialType === "PAT"
              ? "https://github.com/owner/repo"
              : "git@github.com:owner/repo.git"
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          {credentialType === "PAT"
            ? "HTTPS format for personal access token authentication"
            : "SSH format for SSH key authentication"}
        </p>
      </div>

      {/* Credential Input */}
      <div>
        <label
          htmlFor="credential"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {credentialType === "PAT"
            ? "Personal Access Token"
            : "SSH Private Key"}
        </label>
        <textarea
          id="credential"
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          placeholder={
            credentialType === "PAT"
              ? "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              : "-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"
          }
          rows={credentialType === "SSH" ? 8 : 3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          {credentialType === "PAT"
            ? "Required scopes: repo (full repository access)"
            : "Paste your complete SSH private key including header and footer"}
        </p>
      </div>

      {/* Validation Result */}
      {validationResult && (
        <div
          className={`rounded-md p-3 ${
            validationResult.valid
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {validationResult.valid ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <span
              className={`text-sm ${
                validationResult.valid ? "text-green-800" : "text-red-800"
              }`}
            >
              {validationResult.message}
            </span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-sm text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <button
          type="button"
          onClick={handleValidate}
          disabled={validating || !repositoryUrl || !credential}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {validating && <Loader2 className="h-4 w-4 animate-spin" />}
          Test Connection
        </button>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={submitting || !repositoryUrl || !credential}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Credential
          </button>
        </div>
      </div>
    </form>
  );
}
