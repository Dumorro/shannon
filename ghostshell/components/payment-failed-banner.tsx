"use client";

import { useState } from "react";
import { AlertTriangle, X, CreditCard, Loader2 } from "lucide-react";

interface PaymentFailedBannerProps {
  organizationId: string;
  onDismiss?: () => void;
}

export function PaymentFailedBanner({
  organizationId,
  onDismiss,
}: PaymentFailedBannerProps) {
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleUpdatePayment = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to open billing portal:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) {
    return null;
  }

  return (
    <div className="bg-red-50 border-b border-red-200">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-sm font-medium text-red-800">
              Payment failed. Please update your payment method to avoid service
              interruption.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpdatePayment}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  Update Payment
                </>
              )}
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-md p-1.5 text-red-500 hover:bg-red-100 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
