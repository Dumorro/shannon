"use client";

import { useState, useEffect } from "react";
import { Activity, TrendingUp, AlertTriangle } from "lucide-react";

interface UsageStats {
  current: {
    tokensUsed: number;
    tokensAllowance: number;
    percentage: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
  } | null;
  overage: {
    tokens: number;
    cost: number;
  };
  history: Array<{
    periodStart: string;
    periodEnd: string;
    tokensUsed: number;
    tokensAllowance: number;
  }>;
}

interface UsageIndicatorProps {
  organizationId: string;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function UsageIndicator({ organizationId }: UsageIndicatorProps) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const response = await fetch(`/api/org/${organizationId}/usage`);
        if (!response.ok) {
          throw new Error("Failed to fetch usage");
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error("Error fetching usage:", err);
        setError("Unable to load usage data");
      } finally {
        setLoading(false);
      }
    }

    fetchUsage();
  }, [organizationId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
          <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  if (error || !stats?.current) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3 text-gray-500">
          <Activity className="h-5 w-5" />
          <span className="text-sm">{error || "No usage data available"}</span>
        </div>
      </div>
    );
  }

  const { current, overage } = stats;
  const isNearLimit = current.percentage >= 80;
  const isOverLimit = current.percentage >= 100;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-gray-400" />
          <h3 className="font-medium text-gray-900">Token Usage</h3>
        </div>
        <span className="text-sm text-gray-500">
          {formatDate(current.periodStart)} - {formatDate(current.periodEnd)}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex items-end justify-between text-sm">
          <span className="font-medium text-gray-900">
            {formatTokens(current.tokensUsed)} / {formatTokens(current.tokensAllowance)}
          </span>
          <span
            className={
              isOverLimit
                ? "font-medium text-red-600"
                : isNearLimit
                ? "font-medium text-amber-600"
                : "text-gray-500"
            }
          >
            {current.percentage}%
          </span>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all ${
              isOverLimit
                ? "bg-red-500"
                : isNearLimit
                ? "bg-amber-500"
                : "bg-indigo-500"
            }`}
            style={{ width: `${Math.min(100, current.percentage)}%` }}
          />
        </div>
      </div>

      {/* Warning Message */}
      {isNearLimit && !isOverLimit && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-amber-700">
            You&apos;ve used {current.percentage}% of your monthly allowance
          </span>
        </div>
      )}

      {/* Overage Message */}
      {isOverLimit && overage.tokens > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2">
          <TrendingUp className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-700">
            Overage: {formatTokens(overage.tokens)} tokens (${overage.cost.toFixed(2)})
          </span>
        </div>
      )}

      {/* Remaining */}
      {!isOverLimit && (
        <p className="mt-4 text-sm text-gray-500">
          {formatTokens(current.remaining)} tokens remaining this period
        </p>
      )}
    </div>
  );
}
