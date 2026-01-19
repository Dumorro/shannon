/**
 * Plan Limits Configuration
 * Static plan configuration and limit checking utilities (Epic 010)
 */

import type { PlanType, PlanLimitsConfig, PlanFeatures, BillingInterval } from "./types";

// Static plan configuration (mirrors PlanLimits table for fast access)
export const PLAN_CONFIG: Record<PlanType, PlanLimitsConfig> = {
  free: {
    planName: "free",
    concurrentScans: 1,
    teamMembers: 1,
    scanDurationMinutes: 30,
    monthlyTokenAllowance: 50_000,
    features: {
      customReports: false,
      apiAccess: false,
      scheduledScans: false,
    },
    monthlyPriceUsd: 0,
    annualPriceUsd: null,
  },
  pro: {
    planName: "pro",
    concurrentScans: 3,
    teamMembers: 5,
    scanDurationMinutes: 60,
    monthlyTokenAllowance: 500_000,
    features: {
      customReports: true,
      apiAccess: false,
      scheduledScans: true,
    },
    monthlyPriceUsd: 99_00, // $99.00 in cents
    annualPriceUsd: 990_00, // $990.00 in cents (2 months free)
  },
  enterprise: {
    planName: "enterprise",
    concurrentScans: 10,
    teamMembers: 2147483647, // MAX_INT for unlimited
    scanDurationMinutes: 120,
    monthlyTokenAllowance: 5_000_000,
    features: {
      customReports: true,
      apiAccess: true,
      scheduledScans: true,
    },
    monthlyPriceUsd: 0, // Custom pricing
    annualPriceUsd: null,
  },
};

// Overage rate: $1.00 per 1,000,000 tokens
export const OVERAGE_RATE_PER_MILLION_TOKENS = 1.0;

/**
 * Get plan limits for a given plan type
 */
export function getPlanLimits(plan: PlanType): PlanLimitsConfig {
  return PLAN_CONFIG[plan];
}

/**
 * Check if a plan has a specific feature
 */
export function hasFeatureAccess(plan: PlanType, feature: keyof PlanFeatures): boolean {
  return PLAN_CONFIG[plan].features[feature];
}

/**
 * Get concurrent scan limit for a plan
 */
export function getConcurrentScanLimit(plan: PlanType): number {
  return PLAN_CONFIG[plan].concurrentScans;
}

/**
 * Get team member limit for a plan
 */
export function getTeamMemberLimit(plan: PlanType): number {
  return PLAN_CONFIG[plan].teamMembers;
}

/**
 * Get scan duration limit in minutes for a plan
 */
export function getScanDurationLimit(plan: PlanType): number {
  return PLAN_CONFIG[plan].scanDurationMinutes;
}

/**
 * Get monthly token allowance for a plan
 */
export function getMonthlyTokenAllowance(plan: PlanType): number {
  return PLAN_CONFIG[plan].monthlyTokenAllowance;
}

/**
 * Check if team member limit would be exceeded
 */
export function checkTeamMemberLimit(
  plan: PlanType,
  currentCount: number,
  adding: number = 1
): { allowed: boolean; limit: number; wouldHave: number } {
  const limit = getTeamMemberLimit(plan);
  const wouldHave = currentCount + adding;
  return {
    allowed: wouldHave <= limit,
    limit,
    wouldHave,
  };
}

/**
 * Check if concurrent scan limit would be exceeded
 */
export function checkConcurrentScanLimit(
  plan: PlanType,
  currentRunning: number
): { allowed: boolean; limit: number; current: number } {
  const limit = getConcurrentScanLimit(plan);
  return {
    allowed: currentRunning < limit,
    limit,
    current: currentRunning,
  };
}

/**
 * Check if scan duration is within limits
 */
export function checkScanDurationLimit(
  plan: PlanType,
  durationMinutes: number
): { allowed: boolean; limit: number; requested: number } {
  const limit = getScanDurationLimit(plan);
  return {
    allowed: durationMinutes <= limit,
    limit,
    requested: durationMinutes,
  };
}

/**
 * Calculate overage cost for tokens beyond allowance
 */
export function calculateOverageCost(tokensUsed: number, allowance: number): number {
  const overage = Math.max(0, tokensUsed - allowance);
  return (overage / 1_000_000) * OVERAGE_RATE_PER_MILLION_TOKENS;
}

/**
 * Get price for a plan and interval
 */
export function getPlanPrice(plan: PlanType, interval: BillingInterval): number | null {
  const config = PLAN_CONFIG[plan];
  if (interval === "annual") {
    return config.annualPriceUsd;
  }
  return config.monthlyPriceUsd;
}

/**
 * Get annual savings amount for a plan (compared to 12 months of monthly)
 */
export function getAnnualSavings(plan: PlanType): number | null {
  const config = PLAN_CONFIG[plan];
  if (config.annualPriceUsd === null || config.monthlyPriceUsd === 0) {
    return null;
  }
  return config.monthlyPriceUsd * 12 - config.annualPriceUsd;
}

/**
 * Format price in cents to display string
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Check if plan is paid (not free)
 */
export function isPaidPlan(plan: PlanType): boolean {
  return plan !== "free";
}

/**
 * Check if plan is upgradeable (not enterprise)
 */
export function isUpgradeablePlan(plan: PlanType): boolean {
  return plan !== "enterprise";
}

/**
 * Get next tier upgrade from current plan
 */
export function getUpgradePath(currentPlan: PlanType): PlanType | null {
  switch (currentPlan) {
    case "free":
      return "pro";
    case "pro":
      return "enterprise";
    case "enterprise":
      return null;
  }
}
