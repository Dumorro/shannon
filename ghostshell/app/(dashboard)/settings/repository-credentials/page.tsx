"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Key, Plus } from "lucide-react";
import { CredentialList } from "@/components/repository/CredentialList";
import { CredentialForm } from "@/components/repository/CredentialForm";
import type { CredentialType } from "@prisma/client";

interface Credential {
  id: string;
  repositoryUrl: string;
  credentialType: CredentialType;
  validationStatus: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
  usageCount?: number;
}

/**
 * T066: Repository credentials settings page
 * User Story 3: Multi-Repository Projects
 *
 * Allows managing repository credentials for private repository scanning
 */
export default function RepositoryCredentialsPage() {
  const { user, isLoaded } = useUser();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchCredentials = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/repository-credentials");
      if (response.ok) {
        const data = await response.json();
        setCredentials(data.credentials || []);
      } else {
        console.error("Failed to fetch credentials");
      }
    } catch (error) {
      console.error("Error fetching credentials:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      fetchCredentials();
    }
  }, [isLoaded]);

  const handleSuccess = (credentialId: string) => {
    setMessage({
      type: "success",
      text: "Credential saved successfully",
    });
    setShowForm(false);
    fetchCredentials();
  };

  const handleEdit = (credentialId: string) => {
    // TODO: Implement edit functionality
    console.log("Edit credential:", credentialId);
  };

  const handleDelete = () => {
    fetchCredentials();
    setMessage({
      type: "success",
      text: "Credential deleted successfully",
    });
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Repository Credentials
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage authentication credentials for scanning private repositories
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setShowForm(true);
              setMessage(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Credential
          </button>
        )}
      </div>

      {message && (
        <div
          className={`rounded-lg p-4 ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Add Credential Form */}
      {showForm && (
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <CredentialForm
            onSuccess={handleSuccess}
            onCancel={() => {
              setShowForm(false);
              setMessage(null);
            }}
          />
        </section>
      )}

      {/* Credentials List */}
      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <Key className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">
              Saved Credentials
            </h2>
          </div>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : (
            <CredentialList
              credentials={credentials}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRefresh={fetchCredentials}
            />
          )}
        </div>
      </section>

      {/* Information Section */}
      <section className="rounded-lg border border-gray-200 bg-blue-50 p-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          About Repository Credentials
        </h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>
            Credentials are encrypted using AES-256-GCM and stored securely
          </li>
          <li>
            Personal Access Tokens (PAT) require "repo" scope for full repository
            access
          </li>
          <li>SSH keys must include the complete private key with header and footer</li>
          <li>
            Test connections validate access to repositories before saving
          </li>
          <li>
            Credentials are automatically selected when scanning matching repositories
          </li>
        </ul>
      </section>
    </div>
  );
}
