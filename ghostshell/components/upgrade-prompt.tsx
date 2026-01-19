"use client";

import { useState } from "react";
import { X, ArrowUpRight, Zap, Users, Clock, Shield } from "lucide-react";
import type { PlanType } from "@/lib/billing/types";

interface UpgradePromptProps {
  organizationId: string;
  currentPlan: PlanType;
  limitType: "concurrent_scans" | "team_members" | "scan_duration" | "feature";
  limitValue?: number;
  featureName?: string;
  onDismiss?: () => void;
}

const LIMIT_MESSAGES: Record<string, { icon: React.ReactNode; title: string; description: string }> = {
  concurrent_scans: {
    icon: <Zap className="h-5 w-5 text-indigo-500" />,
    title: "Concurrent Scan Limit Reached",
    description: "You've reached the maximum number of concurrent scans for your plan.",
  },
  team_members: {
    icon: <Users className="h-5 w-5 text-indigo-500" />,
    title: "Team Member Limit Reached",
    description: "You've reached the maximum number of team members for your plan.",
  },
  scan_duration: {
    icon: <Clock className="h-5 w-5 text-indigo-500" />,
    title: "Scan Duration Limit",
    description: "The requested scan duration exceeds your plan's limit.",
  },
  feature: {
    icon: <Shield className="h-5 w-5 text-indigo-500" />,
    title: "Feature Not Available",
    description: "This feature is not included in your current plan.",
  },
};

const PLAN_BENEFITS: Record<PlanType, string[]> = {
  free: [],
  pro: [
    "Up to 3 concurrent scans",
    "Up to 5 team members",
    "60-minute scan duration",
    "Custom reports",
    "Scheduled scans",
  ],
  enterprise: [
    "Up to 10 concurrent scans",
    "Unlimited team members",
    "2-hour scan duration",
    "All Pro features",
    "API access",
    "Priority support",
  ],
};

export function UpgradePrompt({
  organizationId,
  currentPlan,
  limitType,
  limitValue,
  featureName,
  onDismiss,
}: UpgradePromptProps) {
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  const messageConfig = LIMIT_MESSAGES[limitType];
  const targetPlan: PlanType = currentPlan === "free" ? "pro" : "enterprise";
  const benefits = PLAN_BENEFITS[targetPlan];

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          plan: targetPlan,
          interval: "monthly",
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to start upgrade:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          {messageConfig.icon}
          <h2 className="text-lg font-semibold text-gray-900">
            {messageConfig.title}
          </h2>
        </div>

        {/* Description */}
        <p className="mt-2 text-sm text-gray-600">
          {limitType === "feature" && featureName
            ? `${featureName} is not included in your current plan.`
            : messageConfig.description}
          {limitValue !== undefined && (
            <span className="ml-1 font-medium">
              (Current limit: {limitValue})
            </span>
          )}
        </p>

        {/* Benefits */}
        <div className="mt-4 rounded-lg bg-indigo-50 p-4">
          <h3 className="font-medium text-indigo-900">
            Upgrade to {targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)} to get:
          </h3>
          <ul className="mt-2 space-y-1">
            {benefits.map((benefit, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-indigo-700">
                <span className="text-indigo-500">✓</span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Maybe Later
          </button>
          {targetPlan === "enterprise" ? (
            <a
              href={`mailto:sales@example.com?subject=Enterprise%20Plan%20Inquiry&body=Organization%20ID:%20${organizationId}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Contact Sales
              <ArrowUpRight className="h-4 w-4" />
            </a>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  Upgrade Now
                  <ArrowUpRight className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline upgrade prompt for use within forms/sections
 */
export function InlineUpgradePrompt({
  organizationId,
  currentPlan,
  limitType,
  limitValue,
  featureName,
}: Omit<UpgradePromptProps, "onDismiss">) {
  const [loading, setLoading] = useState(false);

  const messageConfig = LIMIT_MESSAGES[limitType];
  const targetPlan: PlanType = currentPlan === "free" ? "pro" : "enterprise";

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          plan: targetPlan,
          interval: "monthly",
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to start upgrade:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        {messageConfig.icon}
        <div className="flex-1">
          <h3 className="font-medium text-amber-900">{messageConfig.title}</h3>
          <p className="mt-1 text-sm text-amber-700">
            {limitType === "feature" && featureName
              ? `${featureName} is not included in your current plan.`
              : messageConfig.description}
            {limitValue !== undefined && (
              <span className="ml-1 font-medium">(Limit: {limitValue})</span>
            )}
          </p>
          <div className="mt-3">
            {targetPlan === "enterprise" ? (
              <a
                href={`mailto:sales@example.com?subject=Enterprise%20Plan%20Inquiry`}
                className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
              >
                Contact Sales
                <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
              >
                {loading ? "Loading..." : "Upgrade to Pro"}
                <ArrowUpRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
