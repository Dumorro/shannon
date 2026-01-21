"use client";

import { useState, useCallback, useEffect } from "react";
import { GitBranch, GitFork, X } from "lucide-react";

export interface RepositoryFilterState {
  repositoryUrl?: string;
  repositoryBranch?: string;
}

interface RepositoryFilterProps {
  onFilterChange: (filters: RepositoryFilterState) => void;
  initialRepositoryUrl?: string;
  initialRepositoryBranch?: string;
  organizationId: string;
}

interface RepositoryOption {
  url: string;
  count: number;
}

interface BranchOption {
  branch: string;
  count: number;
}

/**
 * T057: RepositoryFilter component with URL and branch dropdowns
 * User Story 2: Branch-Specific Scanning
 *
 * Allows filtering scans by repository URL and branch for cross-branch comparison
 */
export function RepositoryFilter({
  onFilterChange,
  initialRepositoryUrl,
  initialRepositoryBranch,
  organizationId,
}: RepositoryFilterProps) {
  const [selectedRepositoryUrl, setSelectedRepositoryUrl] = useState(
    initialRepositoryUrl || ""
  );
  const [selectedBranch, setSelectedBranch] = useState(
    initialRepositoryBranch || ""
  );
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  // Repository options state
  const [repositories, setRepositories] = useState<RepositoryOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Fetch unique repositories for this organization
  useEffect(() => {
    async function fetchRepositories() {
      setLoadingRepos(true);
      try {
        // This would ideally be a dedicated API endpoint, but we can use the scans API
        // to get unique repository URLs
        const response = await fetch(`/api/scans?limit=1000`);
        if (response.ok) {
          const data = await response.json();
          const scans = data.scans || [];

          // Count scans per repository URL
          const urlCounts = new Map<string, number>();
          for (const scan of scans) {
            if (scan.repositoryUrl) {
              const count = urlCounts.get(scan.repositoryUrl) || 0;
              urlCounts.set(scan.repositoryUrl, count + 1);
            }
          }

          const repoOptions: RepositoryOption[] = Array.from(urlCounts.entries())
            .map(([url, count]) => ({ url, count }))
            .sort((a, b) => b.count - a.count); // Sort by most scans first

          setRepositories(repoOptions);
        }
      } catch (error) {
        console.error("Failed to fetch repositories:", error);
      } finally {
        setLoadingRepos(false);
      }
    }

    fetchRepositories();
  }, [organizationId]);

  // Fetch branches for selected repository
  useEffect(() => {
    if (!selectedRepositoryUrl) {
      setBranches([]);
      return;
    }

    async function fetchBranches() {
      setLoadingBranches(true);
      try {
        const response = await fetch(
          `/api/scans?repositoryUrl=${encodeURIComponent(selectedRepositoryUrl)}&limit=1000`
        );
        if (response.ok) {
          const data = await response.json();
          const scans = data.scans || [];

          // Count scans per branch
          const branchCounts = new Map<string, number>();
          for (const scan of scans) {
            if (scan.repositoryBranch) {
              const count = branchCounts.get(scan.repositoryBranch) || 0;
              branchCounts.set(scan.repositoryBranch, count + 1);
            }
          }

          const branchOptions: BranchOption[] = Array.from(branchCounts.entries())
            .map(([branch, count]) => ({ branch, count }))
            .sort((a, b) => {
              // Sort main/master first, then by count
              if (a.branch === "main" || a.branch === "master") return -1;
              if (b.branch === "main" || b.branch === "master") return 1;
              return b.count - a.count;
            });

          setBranches(branchOptions);
        }
      } catch (error) {
        console.error("Failed to fetch branches:", error);
      } finally {
        setLoadingBranches(false);
      }
    }

    fetchBranches();
  }, [selectedRepositoryUrl]);

  const handleRepositoryChange = useCallback(
    (url: string) => {
      setSelectedRepositoryUrl(url);
      setSelectedBranch(""); // Reset branch when repository changes
      onFilterChange({
        repositoryUrl: url || undefined,
        repositoryBranch: undefined,
      });
      setShowRepoDropdown(false);
    },
    [onFilterChange]
  );

  const handleBranchChange = useCallback(
    (branch: string) => {
      setSelectedBranch(branch);
      onFilterChange({
        repositoryUrl: selectedRepositoryUrl || undefined,
        repositoryBranch: branch || undefined,
      });
      setShowBranchDropdown(false);
    },
    [selectedRepositoryUrl, onFilterChange]
  );

  const clearFilters = useCallback(() => {
    setSelectedRepositoryUrl("");
    setSelectedBranch("");
    onFilterChange({});
  }, [onFilterChange]);

  const hasActiveFilters = selectedRepositoryUrl || selectedBranch;

  // Get display name for repository (show last part of URL)
  const getRepoDisplayName = (url: string) => {
    try {
      const parts = url.replace(/\.git$/, "").split("/");
      return parts[parts.length - 1] || url;
    } catch {
      return url;
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Repository URL filter */}
      <div className="relative">
        <button
          onClick={() => setShowRepoDropdown(!showRepoDropdown)}
          disabled={loadingRepos}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <GitFork className="h-4 w-4 text-gray-400" />
          {selectedRepositoryUrl ? (
            <span className="max-w-[200px] truncate">
              {getRepoDisplayName(selectedRepositoryUrl)}
            </span>
          ) : (
            "Repository"
          )}
        </button>

        {showRepoDropdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowRepoDropdown(false)}
            />
            <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-80 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
              {repositories.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No repositories found
                </div>
              ) : (
                <>
                  <button
                    onClick={() => handleRepositoryChange("")}
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <span className="text-sm text-gray-700">All repositories</span>
                  </button>
                  {repositories.map((repo) => (
                    <button
                      key={repo.url}
                      onClick={() => handleRepositoryChange(repo.url)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50 ${
                        selectedRepositoryUrl === repo.url ? "bg-indigo-50" : ""
                      }`}
                    >
                      <span className="truncate text-sm text-gray-700">
                        {getRepoDisplayName(repo.url)}
                      </span>
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {repo.count}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Branch filter (only shown when repository is selected) */}
      {selectedRepositoryUrl && (
        <div className="relative">
          <button
            onClick={() => setShowBranchDropdown(!showBranchDropdown)}
            disabled={loadingBranches}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <GitBranch className="h-4 w-4 text-gray-400" />
            {selectedBranch || "All branches"}
          </button>

          {showBranchDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowBranchDropdown(false)}
              />
              <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-48 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                {branches.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No branches found
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleBranchChange("")}
                      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <span className="text-sm text-gray-700">All branches</span>
                    </button>
                    {branches.map((branch) => (
                      <button
                        key={branch.branch}
                        onClick={() => handleBranchChange(branch.branch)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50 ${
                          selectedBranch === branch.branch ? "bg-indigo-50" : ""
                        }`}
                      >
                        <span className="text-sm text-gray-700">{branch.branch}</span>
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {branch.count}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
          Clear
        </button>
      )}
    </div>
  );
}
