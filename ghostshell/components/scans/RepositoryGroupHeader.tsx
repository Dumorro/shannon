"use client";

import { useState } from "react";
import { GitFork, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

interface RepositoryGroupHeaderProps {
  repositoryUrl: string;
  scanCount: number;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  latestScanDate: string | null;
  defaultExpanded?: boolean;
}

/**
 * T073: RepositoryGroupHeader component showing repo summary stats
 * User Story 3: Multi-Repository Projects
 *
 * Displays summary statistics for a group of scans from the same repository
 */
export function RepositoryGroupHeader({
  repositoryUrl,
  scanCount,
  totalFindings,
  criticalCount,
  highCount,
  mediumCount,
  lowCount,
  latestScanDate,
  defaultExpanded = true,
}: RepositoryGroupHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-gray-50 border-b border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1">
          {/* Expand/Collapse Icon */}
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
          )}

          {/* Repository Icon and URL */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <GitFork className="h-5 w-5 text-gray-500 flex-shrink-0" />
            <span className="font-mono text-sm font-medium text-gray-900 truncate">
              {repositoryUrl}
            </span>
          </div>

          {/* Summary Stats */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Scan Count */}
            <div className="text-sm text-gray-600">
              <span className="font-medium">{scanCount}</span>{" "}
              {scanCount === 1 ? "scan" : "scans"}
            </div>

            {/* Total Findings */}
            {totalFindings > 0 && (
              <div className="flex items-center gap-4">
                {/* Critical */}
                {criticalCount > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {criticalCount}
                    </span>
                  </div>
                )}

                {/* High */}
                {highCount > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-orange-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {highCount}
                    </span>
                  </div>
                )}

                {/* Medium */}
                {mediumCount > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {mediumCount}
                    </span>
                  </div>
                )}

                {/* Low */}
                {lowCount > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {lowCount}
                    </span>
                  </div>
                )}

                {/* Total */}
                <div className="text-sm text-gray-600">
                  {totalFindings} total
                </div>
              </div>
            )}

            {/* Latest Scan Date */}
            {latestScanDate && (
              <div className="text-sm text-gray-500">
                Latest:{" "}
                {new Date(latestScanDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Expandable Content - could be used for additional stats */}
      {isExpanded && (
        <div className="px-6 py-2 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center gap-6 text-xs text-gray-600">
            <span>Repository: {repositoryUrl}</span>
            {totalFindings === 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <AlertTriangle className="h-3 w-3" />
                No findings in recent scans
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
