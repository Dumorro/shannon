"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Plus, Layers, List } from "lucide-react";
import { ScanHistoryTable } from "./scan-history-table";
import { ScanFilters, type ScanStatusFilter } from "./scan-filters";
import { RepositoryFilter, type RepositoryFilterState } from "./RepositoryFilter";
import { RepositoryGroupHeader } from "./RepositoryGroupHeader";
import { PaginationControls } from "@/components/ui/pagination-controls";

interface Scan {
  id: string;
  projectId: string;
  projectName: string;
  status: string;
  source: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  createdAt: string;
  // T030: Repository fields
  repositoryUrl?: string | null;
  repositoryBranch?: string | null;
  repositoryCommitHash?: string | null;
}

interface ScansPageClientProps {
  initialScans: Scan[];
  initialNextCursor: string | null;
  initialTotal: number;
  organizationId: string; // T058: For RepositoryFilter
}

export function ScansPageClient({
  initialScans,
  initialNextCursor,
  initialTotal,
  organizationId,
}: ScansPageClientProps) {
  const [scans, setScans] = useState<Scan[]>(initialScans);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [total, setTotal] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<{
    status: ScanStatusFilter[];
    dateFrom?: string;
    dateTo?: string;
  }>({ status: [] });
  // T058: Repository filter state
  const [repositoryFilters, setRepositoryFilters] = useState<RepositoryFilterState>({});
  // T072: Repository grouping state
  const [groupByRepository, setGroupByRepository] = useState(false);

  const fetchScans = useCallback(async (
    cursor?: string,
    newFilters?: typeof filters,
    newRepoFilters?: RepositoryFilterState
  ) => {
    setIsLoading(true);
    try {
      const currentFilters = newFilters || filters;
      const currentRepoFilters = newRepoFilters || repositoryFilters;
      const params = new URLSearchParams();

      if (currentFilters.status.length > 0) {
        params.set("status", currentFilters.status.join(","));
      }
      if (currentFilters.dateFrom) {
        params.set("startDate", currentFilters.dateFrom);
      }
      if (currentFilters.dateTo) {
        params.set("endDate", currentFilters.dateTo);
      }
      // T052-T053: Add repository filters
      if (currentRepoFilters.repositoryUrl) {
        params.set("repositoryUrl", currentRepoFilters.repositoryUrl);
      }
      if (currentRepoFilters.repositoryBranch) {
        params.set("repositoryBranch", currentRepoFilters.repositoryBranch);
      }
      if (cursor) {
        params.set("cursor", cursor);
      }
      params.set("limit", "50");

      const response = await fetch(`/api/scans?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch scans");
      }

      const data = await response.json();

      if (cursor) {
        // Append to existing scans
        setScans((prev) => [...prev, ...data.scans]);
      } else {
        // Replace scans
        setScans(data.scans);
      }
      setNextCursor(data.nextCursor);
      setTotal(data.total);
    } catch (error) {
      console.error("Error fetching scans:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, repositoryFilters]);

  const handleFilterChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    // Fetch with new filters, reset pagination
    fetchScans(undefined, newFilters);
  }, [fetchScans]);

  // T058: Repository filter handler
  const handleRepositoryFilterChange = useCallback((newRepoFilters: RepositoryFilterState) => {
    setRepositoryFilters(newRepoFilters);
    // Fetch with new repository filters, reset pagination
    fetchScans(undefined, undefined, newRepoFilters);
  }, [fetchScans]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor) return;
    await fetchScans(nextCursor);
  }, [nextCursor, fetchScans]);

  // T072: Group scans by repository URL
  const groupedScans = useMemo(() => {
    if (!groupByRepository) return null;

    const groups = new Map<
      string,
      {
        repositoryUrl: string;
        scans: Scan[];
        totalFindings: number;
        criticalCount: number;
        highCount: number;
        mediumCount: number;
        lowCount: number;
        latestScanDate: string | null;
      }
    >();

    // Group scans by repository URL
    scans.forEach((scan) => {
      const repoUrl = scan.repositoryUrl || "No Repository";

      if (!groups.has(repoUrl)) {
        groups.set(repoUrl, {
          repositoryUrl: repoUrl,
          scans: [],
          totalFindings: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          latestScanDate: null,
        });
      }

      const group = groups.get(repoUrl)!;
      group.scans.push(scan);
      group.totalFindings += scan.findingsCount;
      group.criticalCount += scan.criticalCount;
      group.highCount += scan.highCount;
      group.mediumCount += scan.mediumCount;
      group.lowCount += scan.lowCount;

      // Update latest scan date
      if (
        scan.completedAt &&
        (!group.latestScanDate || scan.completedAt > group.latestScanDate)
      ) {
        group.latestScanDate = scan.completedAt;
      }
    });

    // Convert to array and sort by latest scan date
    return Array.from(groups.values()).sort((a, b) => {
      if (!a.latestScanDate) return 1;
      if (!b.latestScanDate) return -1;
      return b.latestScanDate.localeCompare(a.latestScanDate);
    });
  }, [scans, groupByRepository]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Security Scans</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage security scans across your projects
          </p>
        </div>
        <Link
          href="/dashboard/scans/new"
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          New Scan
        </Link>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <ScanFilters
          onFilterChange={handleFilterChange}
          initialStatus={filters.status}
          initialDateFrom={filters.dateFrom}
          initialDateTo={filters.dateTo}
        />
        {/* T058: Repository filter */}
        <RepositoryFilter
          onFilterChange={handleRepositoryFilterChange}
          initialRepositoryUrl={repositoryFilters.repositoryUrl}
          initialRepositoryBranch={repositoryFilters.repositoryBranch}
          organizationId={organizationId}
        />
        {/* T072: Group by repository toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGroupByRepository(!groupByRepository)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              groupByRepository
                ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {groupByRepository ? (
              <>
                <Layers className="h-4 w-4" />
                Grouped by Repository
              </>
            ) : (
              <>
                <List className="h-4 w-4" />
                List View
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scans table or grouped view */}
      {groupByRepository && groupedScans ? (
        // T072: Grouped view by repository
        <div className="space-y-4">
          {groupedScans.map((group) => (
            <div
              key={group.repositoryUrl}
              className="border border-gray-200 rounded-lg overflow-hidden bg-white"
            >
              <RepositoryGroupHeader
                repositoryUrl={group.repositoryUrl}
                scanCount={group.scans.length}
                totalFindings={group.totalFindings}
                criticalCount={group.criticalCount}
                highCount={group.highCount}
                mediumCount={group.mediumCount}
                lowCount={group.lowCount}
                latestScanDate={group.latestScanDate}
                defaultExpanded={true}
              />
              <ScanHistoryTable
                scans={group.scans}
                nextCursor={null}
                total={group.scans.length}
                hideHeader={true}
              />
            </div>
          ))}
        </div>
      ) : (
        // Standard list view
        <ScanHistoryTable
          scans={scans}
          nextCursor={nextCursor}
          total={total}
        />
      )}

      {/* Pagination */}
      <PaginationControls
        hasMore={!!nextCursor}
        total={total}
        currentCount={scans.length}
        onLoadMore={handleLoadMore}
        isLoading={isLoading}
      />
    </div>
  );
}
