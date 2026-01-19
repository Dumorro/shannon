/**
 * Scan queue management utilities.
 *
 * Handles concurrent scan limits and queue position tracking.
 */

import { db } from "@/lib/db";
import { getConcurrentScanLimit, checkConcurrentScanLimit as checkPlanLimit } from "@/lib/billing/plan-limits";
import type { PlanType } from "@/lib/billing/types";

/**
 * Check if an organization can start a new scan.
 *
 * @param orgId - Organization ID
 * @returns Whether a new scan can start, current count, limit, and plan info
 */
export async function checkConcurrentLimit(orgId: string): Promise<{
  canStart: boolean;
  currentCount: number;
  limit: number;
  plan: PlanType;
}> {
  // Get organization plan
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });

  const plan = (org?.plan || "free") as PlanType;
  const limit = getConcurrentScanLimit(plan);

  // Count currently active scans (PENDING or RUNNING)
  const currentCount = await db.scan.count({
    where: {
      organizationId: orgId,
      status: {
        in: ["PENDING", "RUNNING"],
      },
    },
  });

  const result = checkPlanLimit(plan, currentCount);

  return {
    canStart: result.allowed,
    currentCount,
    limit,
    plan,
  };
}

/**
 * Get the queue position for a specific scan.
 *
 * @param orgId - Organization ID
 * @param scanId - Scan ID to check
 * @returns Queue position (1-based) or null if scan is not queued
 */
export async function getQueuePosition(
  orgId: string,
  scanId: string
): Promise<number | null> {
  // Get the scan to check its status
  const scan = await db.scan.findFirst({
    where: {
      id: scanId,
      organizationId: orgId,
    },
  });

  if (!scan || scan.status !== "PENDING") {
    return null;
  }

  // Count how many PENDING scans were created before this one
  const position = await db.scan.count({
    where: {
      organizationId: orgId,
      status: "PENDING",
      createdAt: {
        lt: scan.createdAt,
      },
    },
  });

  // Position is 1-based
  return position + 1;
}

/**
 * Get queue statistics for an organization.
 *
 * @param orgId - Organization ID
 * @returns Queue statistics
 */
export async function getQueueStats(orgId: string): Promise<{
  running: number;
  pending: number;
  limit: number;
  available: number;
  plan: PlanType;
}> {
  // Get organization plan
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });

  const plan = (org?.plan || "free") as PlanType;
  const limit = getConcurrentScanLimit(plan);

  const [running, pending] = await Promise.all([
    db.scan.count({
      where: {
        organizationId: orgId,
        status: "RUNNING",
      },
    }),
    db.scan.count({
      where: {
        organizationId: orgId,
        status: "PENDING",
      },
    }),
  ]);

  const available = Math.max(0, limit - running);

  return {
    running,
    pending,
    limit,
    available,
    plan,
  };
}
