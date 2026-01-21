"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GitCompare, X } from "lucide-react";

interface CompareScanButtonProps {
  currentScanId: string;
  repositoryUrl?: string | null;
  repositoryBranch?: string | null;
}

interface ScanOption {
  id: string;
  repositoryBranch: string;
  completedAt: string;
  findingsCount: number;
}

/**
 * T061: "Compare with..." action button for scan detail page
 * User Story 2: Branch-Specific Scanning
 *
 * Allows selecting another scan from the same repository to compare findings
 */
export function CompareScanButton({
  currentScanId,
  repositoryUrl,
  repositoryBranch,
}: CompareScanButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [scans, setScans] = useState<ScanOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch available scans to compare with
  useEffect(() => {
    if (!isOpen || !repositoryUrl) return;

    async function fetchScans() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          repositoryUrl,
          status: "COMPLETED",
          limit: "50",
        });

        const response = await fetch(`/api/scans?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          // Filter out current scan and scans without branches
          const availableScans = data.scans
            .filter(
              (scan: any) =>
                scan.id !== currentScanId &&
                scan.repositoryBranch &&
                scan.completedAt
            )
            .map((scan: any) => ({
              id: scan.id,
              repositoryBranch: scan.repositoryBranch,
              completedAt: scan.completedAt,
              findingsCount: scan.findingsCount,
            }));
          setScans(availableScans);
        }
      } catch (error) {
        console.error("Failed to fetch scans:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchScans();
  }, [isOpen, repositoryUrl, currentScanId]);

  const handleCompare = (compareScanId: string) => {
    // Navigate to comparison page or modal
    router.push(`/dashboard/scans/compare?scanA=${currentScanId}&scanB=${compareScanId}`);
  };

  // Only show button if scan has repository info
  if (!repositoryUrl || !repositoryBranch) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <GitCompare className="h-4 w-4" />
        Compare with...
      </button>

      {/* Modal */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-25"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Compare with Another Scan
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Select another scan from the same repository to compare findings
              </p>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
                </div>
              ) : scans.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No other completed scans available for comparison
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {scans.map((scan) => (
                    <button
                      key={scan.id}
                      onClick={() => handleCompare(scan.id)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-left"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-gray-900">
                            {scan.repositoryBranch}
                          </span>
                          {scan.repositoryBranch === repositoryBranch && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              Same branch
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          Completed {new Date(scan.completedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        {scan.findingsCount} findings
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
