import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { ScanComparison } from "@/components/scans/ScanComparison";

export const dynamic = "force-dynamic";

interface ComparePageProps {
  searchParams: Promise<{ scanA?: string; scanB?: string }>;
}

/**
 * T061: Scan comparison page
 * User Story 2: Branch-Specific Scanning
 *
 * Displays side-by-side comparison of findings between two scans
 */
export default async function ComparePage({ searchParams }: ComparePageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (user.memberships.length === 0) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const { scanA, scanB } = params;

  if (!scanA || !scanB) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          href="/dashboard/scans"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Scans
        </Link>

        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Invalid Comparison Request
          </h1>
          <p className="text-gray-600">
            Both scanA and scanB parameters are required
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/scans"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Scans
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scan Comparison</h1>
        <p className="mt-1 text-sm text-gray-500">
          Compare findings between two scans to identify security regressions and improvements
        </p>
      </div>

      {/* Comparison component */}
      <ScanComparison scanAId={scanA} scanBId={scanB} />
    </div>
  );
}
