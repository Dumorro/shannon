"use client";

import { useEffect, useState } from "react";
import { GitBranch, GitCommit, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import type { Finding } from "@prisma/client";

interface ScanMetadata {
  id: string;
  projectId: string;
  projectName: string;
  status: string;
  repositoryUrl?: string | null;
  repositoryBranch?: string | null;
  repositoryCommitHash?: string | null;
  findingsCount: number;
  completedAt: string | null;
}

interface ComparisonData {
  scanA: ScanMetadata;
  scanB: ScanMetadata;
  comparison: {
    commonFindings: Finding[];
    onlyInScanA: Finding[];
    onlyInScanB: Finding[];
    summary: {
      totalCommon: number;
      totalOnlyInA: number;
      totalOnlyInB: number;
    };
  };
}

interface ScanComparisonProps {
  scanAId: string;
  scanBId: string;
}

const SEVERITY_COLORS = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-blue-100 text-blue-800 border-blue-200",
  info: "bg-gray-100 text-gray-800 border-gray-200",
};

/**
 * T060: ScanComparison component to show side-by-side findings
 * User Story 2: Branch-Specific Scanning
 *
 * Displays comparison between two scans, highlighting:
 * - Common findings (present in both)
 * - Branch-specific findings (unique to one scan)
 * - Security regressions and improvements
 */
export function ScanComparison({ scanAId, scanBId }: ScanComparisonProps) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchComparison() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/scans/compare?scanA=${scanAId}&scanB=${scanBId}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch comparison");
        }

        const comparisonData = await response.json();
        setData(comparisonData);
      } catch (err) {
        console.error("Error fetching comparison:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    fetchComparison();
  }, [scanAId, scanBId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading comparison...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <XCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Comparison Error</h3>
            <p className="mt-2 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { scanA, scanB, comparison } = data;

  // Helper to get short commit hash
  const getShortCommit = (hash?: string | null) =>
    hash ? hash.slice(0, 8) : "N/A";

  // Helper to render a finding card
  const renderFinding = (finding: Finding, highlightType?: "regression" | "improvement") => (
    <div
      key={finding.id}
      className={`rounded-lg border p-4 ${
        highlightType === "regression"
          ? "border-red-300 bg-red-50"
          : highlightType === "improvement"
          ? "border-green-300 bg-green-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-900">{finding.title}</h4>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                SEVERITY_COLORS[finding.severity.toLowerCase() as keyof typeof SEVERITY_COLORS] ||
                SEVERITY_COLORS.info
              }`}
            >
              {finding.severity}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">
            {finding.description}
          </p>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <span>Category: {finding.category}</span>
            {finding.cwe && <span>CWE: {finding.cwe}</span>}
          </div>
        </div>
        {highlightType && (
          <div className="flex-shrink-0">
            {highlightType === "regression" ? (
              <div className="flex items-center gap-1 text-xs font-medium text-red-600">
                <AlertTriangle className="h-4 w-4" />
                New
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                <CheckCircle className="h-4 w-4" />
                Fixed
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Scan metadata comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scan A */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Scan A: {scanA.projectName}
          </h3>
          <div className="space-y-2 text-sm">
            {scanA.repositoryBranch && (
              <div className="flex items-center gap-2 text-gray-600">
                <GitBranch className="h-4 w-4" />
                <span className="font-mono">{scanA.repositoryBranch}</span>
              </div>
            )}
            {scanA.repositoryCommitHash && (
              <div className="flex items-center gap-2 text-gray-600">
                <GitCommit className="h-4 w-4" />
                <span className="font-mono">{getShortCommit(scanA.repositoryCommitHash)}</span>
              </div>
            )}
            <div className="text-gray-500">
              {scanA.findingsCount} total findings
            </div>
          </div>
        </div>

        {/* Scan B */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Scan B: {scanB.projectName}
          </h3>
          <div className="space-y-2 text-sm">
            {scanB.repositoryBranch && (
              <div className="flex items-center gap-2 text-gray-600">
                <GitBranch className="h-4 w-4" />
                <span className="font-mono">{scanB.repositoryBranch}</span>
              </div>
            )}
            {scanB.repositoryCommitHash && (
              <div className="flex items-center gap-2 text-gray-600">
                <GitCommit className="h-4 w-4" />
                <span className="font-mono">{getShortCommit(scanB.repositoryCommitHash)}</span>
              </div>
            )}
            <div className="text-gray-500">
              {scanB.findingsCount} total findings
            </div>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {comparison.summary.totalCommon}
          </div>
          <div className="mt-1 text-sm text-gray-600">Common Findings</div>
          <p className="mt-1 text-xs text-gray-500">Present in both scans</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <div className="text-2xl font-bold text-red-900">
            {comparison.summary.totalOnlyInB}
          </div>
          <div className="mt-1 text-sm text-red-700">Security Regressions</div>
          <p className="mt-1 text-xs text-red-600">New in Scan B</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <div className="text-2xl font-bold text-green-900">
            {comparison.summary.totalOnlyInA}
          </div>
          <div className="mt-1 text-sm text-green-700">Security Improvements</div>
          <p className="mt-1 text-xs text-green-600">Fixed in Scan B</p>
        </div>
      </div>

      {/* T062: Highlight branch-specific findings */}
      {comparison.onlyInScanB.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Security Regressions ({comparison.onlyInScanB.length})
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            New vulnerabilities found in Scan B that were not present in Scan A
          </p>
          <div className="space-y-3">
            {comparison.onlyInScanB.map((finding) =>
              renderFinding(finding, "regression")
            )}
          </div>
        </div>
      )}

      {/* T062: Highlight branch-specific findings */}
      {comparison.onlyInScanA.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Security Improvements ({comparison.onlyInScanA.length})
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Vulnerabilities from Scan A that have been fixed in Scan B
          </p>
          <div className="space-y-3">
            {comparison.onlyInScanA.map((finding) =>
              renderFinding(finding, "improvement")
            )}
          </div>
        </div>
      )}

      {/* Common findings */}
      {comparison.commonFindings.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Common Findings ({comparison.commonFindings.length})
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Vulnerabilities present in both scans
          </p>
          <div className="space-y-3">
            {comparison.commonFindings.map((finding) => renderFinding(finding))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {comparison.summary.totalCommon === 0 &&
        comparison.summary.totalOnlyInA === 0 &&
        comparison.summary.totalOnlyInB === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600">
              No findings in either scan. Both scans are clean!
            </p>
          </div>
        )}
    </div>
  );
}
