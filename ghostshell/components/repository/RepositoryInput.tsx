"use client";

import { useState } from "react";
import { GitBranch, Info } from "lucide-react";

export interface RepositoryInputValue {
  url: string;
  branch: string;
  commitHash?: string;
}

interface RepositoryInputProps {
  value: RepositoryInputValue;
  onChange: (value: RepositoryInputValue) => void;
  disabled?: boolean;
  error?: string | null;
  showNote?: boolean;
}

export function RepositoryInput({
  value,
  onChange,
  disabled = false,
  error = null,
  showNote = true,
}: RepositoryInputProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-4">
      {/* Repository URL */}
      <div>
        <label
          htmlFor="repository-url"
          className="block text-sm font-medium text-gray-700"
        >
          Repository URL (Optional)
        </label>
        <div className="relative mt-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <GitBranch className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="url"
            id="repository-url"
            value={value.url}
            onChange={(e) =>
              onChange({ ...value, url: e.target.value })
            }
            placeholder="https://github.com/owner/repo or git@github.com:owner/repo"
            disabled={disabled}
            className="block w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50"
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Link this scan to a git repository for reproducibility and code-level
          findings.
        </p>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Branch */}
      {value.url && (
        <div>
          <label
            htmlFor="repository-branch"
            className="block text-sm font-medium text-gray-700"
          >
            Branch
          </label>
          <input
            type="text"
            id="repository-branch"
            value={value.branch}
            onChange={(e) =>
              onChange({ ...value, branch: e.target.value })
            }
            placeholder="main"
            disabled={disabled}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50"
          />
        </div>
      )}

      {/* Advanced: Commit Hash */}
      {value.url && (
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            disabled={disabled}
            className="text-sm text-indigo-600 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {showAdvanced ? "Hide" : "Show"} advanced options
          </button>

          {showAdvanced && (
            <div className="mt-3">
              <label
                htmlFor="repository-commit"
                className="block text-sm font-medium text-gray-700"
              >
                Commit Hash (Optional)
              </label>
              <input
                type="text"
                id="repository-commit"
                value={value.commitHash || ""}
                onChange={(e) =>
                  onChange({ ...value, commitHash: e.target.value || undefined })
                }
                placeholder="abc123def456... (leave empty to use latest)"
                disabled={disabled}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50"
              />
              <p className="mt-2 text-sm text-gray-500">
                Scan a specific commit. If empty, the latest commit from the
                selected branch will be used.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info Note (T048) */}
      {showNote && value.url && (
        <div className="rounded-lg bg-blue-50 p-4">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Repository Scanning</p>
              <p className="mt-1">
                The entire repository will be scanned for security
                vulnerabilities. Subdirectory-only scanning is not supported.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
