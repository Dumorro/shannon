"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Receipt, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import {
  getOrganizationBilling,
  canManageBilling,
} from "@/lib/actions/billing";
import type { BillingInfo } from "@/lib/billing/types";
import { PlanComparison } from "./components/plan-comparison";
import { SubscriptionStatusCard } from "./components/subscription-status";

export default function BillingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgId = params.orgId as string;

  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for success/cancelled query params
  const success = searchParams.get("success") === "true";
  const cancelled = searchParams.get("cancelled") === "true";

  useEffect(() => {
    async function loadBilling() {
      try {
        const [billingData, manageAccess] = await Promise.all([
          getOrganizationBilling(orgId),
          canManageBilling(orgId),
        ]);

        if (!billingData) {
          setError("Unable to load billing information");
          return;
        }

        setBilling(billingData);
        setCanManage(manageAccess);
      } catch (err) {
        console.error("Error loading billing:", err);
        setError("Failed to load billing information");
      } finally {
        setLoading(false);
      }
    }

    loadBilling();
  }, [orgId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !billing) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700">{error || "Unable to load billing information"}</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Plans</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your subscription and view usage
          </p>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <h3 className="font-medium text-green-800">
                Subscription Activated!
              </h3>
              <p className="mt-1 text-sm text-green-700">
                Thank you for upgrading! Your new plan is now active.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled Message */}
      {cancelled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-amber-500" />
            <div>
              <h3 className="font-medium text-amber-800">Checkout Cancelled</h3>
              <p className="mt-1 text-sm text-amber-700">
                Your checkout was cancelled. No charges were made.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Status Card */}
      <SubscriptionStatusCard
        billing={billing}
        organizationId={orgId}
        canManage={canManage}
      />

      {/* Plan Comparison */}
      <section>
        <div className="mb-6 flex items-center gap-3">
          <Receipt className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">
            {billing.plan === "free" ? "Choose a Plan" : "Compare Plans"}
          </h2>
        </div>
        <PlanComparison
          currentPlan={billing.plan}
          organizationId={orgId}
          canManage={canManage}
        />
      </section>
    </div>
  );
}
