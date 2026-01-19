"use client";

import { useState } from "react";
import { Check, X, Zap, Building, Mail } from "lucide-react";
import { PLAN_CONFIG, formatPrice, getAnnualSavings } from "@/lib/billing/plan-limits";
import type { PlanType, BillingInterval } from "@/lib/billing/types";
import { UpgradeButton } from "./upgrade-button";

interface PlanComparisonProps {
  currentPlan: PlanType;
  organizationId: string;
  canManage: boolean;
}

const PLAN_ORDER: PlanType[] = ["free", "pro", "enterprise"];

const PLAN_DISPLAY_NAMES: Record<PlanType, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

const PLAN_DESCRIPTIONS: Record<PlanType, string> = {
  free: "For individuals getting started with security testing",
  pro: "For teams that need more power and collaboration",
  enterprise: "For organizations with advanced security requirements",
};

export function PlanComparison({
  currentPlan,
  organizationId,
  canManage,
}: PlanComparisonProps) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  const proSavings = getAnnualSavings("pro");

  return (
    <div className="space-y-6">
      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-4">
        <span
          className={`text-sm font-medium ${
            interval === "monthly" ? "text-gray-900" : "text-gray-500"
          }`}
        >
          Monthly
        </span>
        <button
          onClick={() => setInterval(interval === "monthly" ? "annual" : "monthly")}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
            interval === "annual" ? "bg-indigo-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              interval === "annual" ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <span
          className={`text-sm font-medium ${
            interval === "annual" ? "text-gray-900" : "text-gray-500"
          }`}
        >
          Annual
        </span>
        {proSavings && (
          <span className="ml-2 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            Save {formatPrice(proSavings)}/year
          </span>
        )}
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {PLAN_ORDER.map((planName) => {
          const config = PLAN_CONFIG[planName];
          const isCurrentPlan = planName === currentPlan;
          const price = interval === "annual" && config.annualPriceUsd !== null
            ? config.annualPriceUsd / 12
            : config.monthlyPriceUsd;
          const isPro = planName === "pro";
          const isEnterprise = planName === "enterprise";

          return (
            <div
              key={planName}
              className={`relative rounded-2xl border-2 bg-white p-6 shadow-sm ${
                isPro
                  ? "border-indigo-600 ring-1 ring-indigo-600"
                  : isCurrentPlan
                  ? "border-green-500"
                  : "border-gray-200"
              }`}
            >
              {/* Popular badge */}
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                    <Zap className="h-3 w-3" />
                    Most Popular
                  </span>
                </div>
              )}

              {/* Current plan badge */}
              {isCurrentPlan && (
                <div className="absolute -top-3 right-4">
                  <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  {PLAN_DISPLAY_NAMES[planName]}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {PLAN_DESCRIPTIONS[planName]}
                </p>

                {/* Price */}
                <div className="mt-4">
                  {isEnterprise ? (
                    <div className="flex items-baseline justify-center">
                      <span className="text-3xl font-bold text-gray-900">Custom</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-gray-900">
                        {formatPrice(price)}
                      </span>
                      <span className="ml-1 text-gray-500">/month</span>
                    </div>
                  )}
                  {isPro && interval === "annual" && (
                    <p className="mt-1 text-sm text-gray-500">
                      Billed annually ({formatPrice(config.annualPriceUsd!)}/year)
                    </p>
                  )}
                </div>
              </div>

              {/* Features */}
              <ul className="mt-6 space-y-3">
                <FeatureItem included={true}>
                  {config.concurrentScans === 1
                    ? "1 concurrent scan"
                    : `${config.concurrentScans} concurrent scans`}
                </FeatureItem>
                <FeatureItem included={true}>
                  {config.teamMembers === 2147483647
                    ? "Unlimited team members"
                    : config.teamMembers === 1
                    ? "1 team member"
                    : `${config.teamMembers} team members`}
                </FeatureItem>
                <FeatureItem included={true}>
                  {config.scanDurationMinutes} min scan duration
                </FeatureItem>
                <FeatureItem included={true}>
                  {formatTokenAllowance(config.monthlyTokenAllowance)} tokens/month
                </FeatureItem>
                <FeatureItem included={config.features.customReports}>
                  Custom reports
                </FeatureItem>
                <FeatureItem included={config.features.scheduledScans}>
                  Scheduled scans
                </FeatureItem>
                <FeatureItem included={config.features.apiAccess}>
                  API access
                </FeatureItem>
              </ul>

              {/* CTA */}
              <div className="mt-6">
                {isCurrentPlan ? (
                  <div className="rounded-lg bg-gray-100 py-2.5 text-center text-sm font-medium text-gray-500">
                    Your current plan
                  </div>
                ) : isEnterprise ? (
                  <a
                    href="mailto:sales@shannon.ai?subject=Enterprise%20Plan%20Inquiry"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Mail className="h-4 w-4" />
                    Contact Sales
                  </a>
                ) : isPro && canManage ? (
                  <UpgradeButton
                    organizationId={organizationId}
                    interval={interval}
                    className="w-full"
                  />
                ) : isPro && !canManage ? (
                  <div className="rounded-lg bg-gray-100 py-2.5 text-center text-sm font-medium text-gray-500">
                    Contact your admin to upgrade
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeatureItem({
  included,
  children,
}: {
  included: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      {included ? (
        <Check className="h-5 w-5 flex-shrink-0 text-green-500" />
      ) : (
        <X className="h-5 w-5 flex-shrink-0 text-gray-300" />
      )}
      <span className={included ? "text-gray-700" : "text-gray-400"}>
        {children}
      </span>
    </li>
  );
}

function formatTokenAllowance(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${tokens / 1_000_000}M`;
  }
  if (tokens >= 1_000) {
    return `${tokens / 1_000}K`;
  }
  return tokens.toString();
}
