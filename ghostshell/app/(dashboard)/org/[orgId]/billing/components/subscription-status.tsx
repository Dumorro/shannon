"use client";

import { useState } from "react";
import {
  CreditCard,
  Calendar,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import type { BillingInfo, SubscriptionStatus } from "@/lib/billing/types";
import { formatPrice } from "@/lib/billing/plan-limits";

interface SubscriptionStatusProps {
  billing: BillingInfo;
  organizationId: string;
  canManage: boolean;
}

const STATUS_CONFIG: Record<
  SubscriptionStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  active: {
    label: "Active",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  past_due: {
    label: "Past Due",
    color: "bg-red-100 text-red-700",
    icon: AlertTriangle,
  },
  canceled: {
    label: "Canceled",
    color: "bg-gray-100 text-gray-700",
    icon: AlertTriangle,
  },
  inactive: {
    label: "Inactive",
    color: "bg-gray-100 text-gray-500",
    icon: CreditCard,
  },
};

export function SubscriptionStatusCard({
  billing,
  organizationId,
  canManage,
}: SubscriptionStatusProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = STATUS_CONFIG[billing.subscriptionStatus];
  const StatusIcon = status.icon;
  const isPaid = billing.plan !== "free" && billing.subscriptionStatus === "active";
  const isPastDue = billing.subscriptionStatus === "past_due";

  const handleManageSubscription = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ organizationId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${status.color}`}
          >
            <StatusIcon className="h-4 w-4" />
            {status.label}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Past Due Warning */}
        {isPastDue && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800">Payment Failed</h3>
                <p className="mt-1 text-sm text-red-700">
                  We couldn&apos;t process your last payment. Please update your payment
                  method to avoid service interruption.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Plan Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Current Plan</p>
            <p className="mt-1 text-lg font-semibold text-gray-900 capitalize">
              {billing.plan}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Price</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {billing.limits.monthlyPriceUsd === 0
                ? "Free"
                : `${formatPrice(billing.limits.monthlyPriceUsd)}/month`}
            </p>
          </div>
        </div>

        {/* Billing Period */}
        {billing.currentPeriodEnd && isPaid && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4" />
            <span>
              {billing.subscriptionStatus === "canceled" ? (
                <>Access until {formatDate(billing.currentPeriodEnd)}</>
              ) : (
                <>Next billing date: {formatDate(billing.currentPeriodEnd)}</>
              )}
            </span>
          </div>
        )}

        {/* Billing Email */}
        {billing.billingEmail && (
          <div>
            <p className="text-sm text-gray-500">Billing Email</p>
            <p className="mt-1 text-gray-900">{billing.billingEmail}</p>
          </div>
        )}

        {/* Manage Subscription Button */}
        {isPaid && canManage && (
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleManageSubscription}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening portal...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4" />
                  Manage Subscription
                </>
              )}
            </button>
            <p className="mt-2 text-xs text-gray-500">
              Update payment method, view invoices, or cancel subscription
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
