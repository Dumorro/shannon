/**
 * Usage Tracking Service
 * Tracks LLM token consumption per organization per billing period (Epic 010)
 */

import { db } from "@/lib/db";
import { getPlanLimits, calculateOverageCost, OVERAGE_RATE_PER_MILLION_TOKENS } from "./plan-limits";
import type { PlanType, UsageSummary } from "./types";

// Usage alert threshold (80% of allowance)
const USAGE_ALERT_THRESHOLD = 0.8;

/**
 * Get or create a usage record for the current billing period
 */
export async function getOrCreateUsageRecord(
  organizationId: string
): Promise<{
  id: string;
  tokensUsed: number;
  tokensAllowance: number;
  periodStart: Date;
  periodEnd: Date;
}> {
  const now = new Date();

  // Try to find existing record for current period
  let record = await db.usageRecord.findFirst({
    where: {
      organizationId,
      periodStart: { lte: now },
      periodEnd: { gt: now },
    },
    orderBy: { periodStart: "desc" },
  });

  if (record) {
    return record;
  }

  // Get organization plan for allowance
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, currentPeriodEnd: true },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  const plan = org.plan as PlanType;
  const planLimits = getPlanLimits(plan);

  // Calculate period start and end
  // Use subscription period if available, otherwise use calendar month
  const periodStart = new Date(now);
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const periodEnd = org.currentPeriodEnd
    ? new Date(org.currentPeriodEnd)
    : new Date(periodStart);
  if (!org.currentPeriodEnd) {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  // Create new usage record
  record = await db.usageRecord.create({
    data: {
      organizationId,
      periodStart,
      periodEnd,
      tokensUsed: 0,
      tokensAllowance: planLimits.monthlyTokenAllowance,
    },
  });

  return record;
}

/**
 * Record token usage for an organization
 */
export async function recordTokenUsage(
  organizationId: string,
  tokens: number
): Promise<{
  tokensUsed: number;
  tokensAllowance: number;
  percentage: number;
  alertTriggered: boolean;
}> {
  const record = await getOrCreateUsageRecord(organizationId);

  const previousPercentage = record.tokensUsed / record.tokensAllowance;
  const newTokensUsed = record.tokensUsed + tokens;
  const newPercentage = newTokensUsed / record.tokensAllowance;

  // Update the record
  await db.usageRecord.update({
    where: { id: record.id },
    data: { tokensUsed: newTokensUsed },
  });

  // Check if we crossed the alert threshold
  const alertTriggered =
    previousPercentage < USAGE_ALERT_THRESHOLD &&
    newPercentage >= USAGE_ALERT_THRESHOLD;

  return {
    tokensUsed: newTokensUsed,
    tokensAllowance: record.tokensAllowance,
    percentage: Math.min(100, Math.round(newPercentage * 100)),
    alertTriggered,
  };
}

/**
 * Get current period usage for an organization
 */
export async function getCurrentPeriodUsage(
  organizationId: string
): Promise<UsageSummary | null> {
  try {
    const record = await getOrCreateUsageRecord(organizationId);

    const percentage = Math.min(
      100,
      Math.round((record.tokensUsed / record.tokensAllowance) * 100)
    );

    return {
      tokensUsed: record.tokensUsed,
      tokensAllowance: record.tokensAllowance,
      percentage,
      remaining: Math.max(0, record.tokensAllowance - record.tokensUsed),
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
    };
  } catch (error) {
    console.error("Error getting usage:", error);
    return null;
  }
}

/**
 * Check if organization has usage allowance remaining
 */
export async function checkUsageAllowance(
  organizationId: string,
  tokensNeeded: number = 0
): Promise<{
  allowed: boolean;
  tokensUsed: number;
  tokensAllowance: number;
  remaining: number;
  wouldExceed: boolean;
}> {
  const record = await getOrCreateUsageRecord(organizationId);
  const remaining = Math.max(0, record.tokensAllowance - record.tokensUsed);
  const wouldExceed = record.tokensUsed + tokensNeeded > record.tokensAllowance;

  // Get organization to check if overages are allowed (paid plans)
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });

  // Free tier: block when over allowance
  // Paid tiers: allow with overage billing
  const isPaidPlan = org?.plan !== "free";
  const allowed = isPaidPlan || remaining > 0;

  return {
    allowed,
    tokensUsed: record.tokensUsed,
    tokensAllowance: record.tokensAllowance,
    remaining,
    wouldExceed,
  };
}

/**
 * Get usage statistics for reporting
 */
export async function getUsageStats(organizationId: string): Promise<{
  current: UsageSummary | null;
  overage: {
    tokens: number;
    cost: number;
  };
  history: Array<{
    periodStart: Date;
    periodEnd: Date;
    tokensUsed: number;
    tokensAllowance: number;
  }>;
}> {
  const current = await getCurrentPeriodUsage(organizationId);

  // Calculate overage
  let overageTokens = 0;
  let overageCost = 0;
  if (current) {
    overageTokens = Math.max(0, current.tokensUsed - current.tokensAllowance);
    overageCost = calculateOverageCost(current.tokensUsed, current.tokensAllowance);
  }

  // Get historical usage (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const history = await db.usageRecord.findMany({
    where: {
      organizationId,
      periodEnd: { lte: new Date() },
      periodStart: { gte: sixMonthsAgo },
    },
    select: {
      periodStart: true,
      periodEnd: true,
      tokensUsed: true,
      tokensAllowance: true,
    },
    orderBy: { periodStart: "desc" },
    take: 6,
  });

  return {
    current,
    overage: {
      tokens: overageTokens,
      cost: overageCost,
    },
    history,
  };
}

/**
 * Send usage alert when threshold is reached
 */
export async function sendUsageAlert(
  organizationId: string,
  percentage: number
): Promise<void> {
  // Get organization and billing email
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      billingEmail: true,
      memberships: {
        where: { role: "owner" },
        select: {
          user: { select: { email: true } },
        },
        take: 1,
      },
    },
  });

  if (!org) return;

  const recipientEmail =
    org.billingEmail || org.memberships[0]?.user.email;

  if (!recipientEmail) return;

  // TODO: Integrate with email service
  console.log(
    `[Usage Alert] Organization ${org.name} has reached ${percentage}% of token allowance. ` +
    `Email would be sent to: ${recipientEmail}`
  );
}

/**
 * Report overage usage to Stripe for metered billing
 */
export async function reportOverageToStripe(
  organizationId: string
): Promise<boolean> {
  const now = new Date();

  // Find completed periods that haven't been reported
  const unreportedRecords = await db.usageRecord.findMany({
    where: {
      organizationId,
      periodEnd: { lt: now },
      reportedToStripe: false,
    },
  });

  if (unreportedRecords.length === 0) {
    return true;
  }

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { stripeSubscriptionId: true },
  });

  if (!org?.stripeSubscriptionId) {
    return false;
  }

  for (const record of unreportedRecords) {
    const overageTokens = Math.max(
      0,
      record.tokensUsed - record.tokensAllowance
    );

    if (overageTokens > 0) {
      // TODO: Report to Stripe metered billing
      // await reportUsageToStripe({
      //   subscriptionId: org.stripeSubscriptionId,
      //   quantity: Math.ceil(overageTokens / 1000), // Per 1K tokens
      //   timestamp: Math.floor(record.periodEnd.getTime() / 1000),
      // });

      // Log billing event
      await db.billingEvent.create({
        data: {
          organizationId,
          eventType: "usage_reported",
          stripeEventId: `usage_${record.id}_${Date.now()}`,
          metadata: {
            tokensReported: overageTokens,
            periodStart: record.periodStart.toISOString(),
            periodEnd: record.periodEnd.toISOString(),
            cost: calculateOverageCost(record.tokensUsed, record.tokensAllowance),
          },
        },
      });
    }

    // Mark as reported
    await db.usageRecord.update({
      where: { id: record.id },
      data: { reportedToStripe: true },
    });
  }

  return true;
}
