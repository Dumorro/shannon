import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the db module
vi.mock("@/lib/db", () => ({
  db: {
    usageRecord: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    billingEvent: {
      create: vi.fn(),
    },
  },
}));

// Mock plan-limits module
vi.mock("@/lib/billing/plan-limits", () => ({
  getPlanLimits: vi.fn((plan: string) => {
    const limits: Record<string, { monthlyTokenAllowance: number }> = {
      free: { monthlyTokenAllowance: 50_000 },
      pro: { monthlyTokenAllowance: 500_000 },
      enterprise: { monthlyTokenAllowance: 5_000_000 },
    };
    return limits[plan] || limits.free;
  }),
  calculateOverageCost: vi.fn((used: number, allowance: number) => {
    const overage = Math.max(0, used - allowance);
    return overage / 1_000_000;
  }),
  OVERAGE_RATE_PER_MILLION_TOKENS: 1.0,
}));

import { db } from "@/lib/db";
import {
  getOrCreateUsageRecord,
  recordTokenUsage,
  getCurrentPeriodUsage,
  checkUsageAllowance,
  getUsageStats,
} from "@/lib/billing/usage-tracker";

describe("Usage Tracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getOrCreateUsageRecord", () => {
    it("should return existing record if found", async () => {
      const mockRecord = {
        id: "record-1",
        tokensUsed: 10000,
        tokensAllowance: 50000,
        periodStart: new Date("2024-01-01"),
        periodEnd: new Date("2024-02-01"),
      };

      vi.mocked(db.usageRecord.findFirst).mockResolvedValue(mockRecord);

      const result = await getOrCreateUsageRecord("org-1");

      expect(result).toEqual(mockRecord);
      expect(db.usageRecord.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
          }),
        })
      );
    });

    it("should create new record if none exists", async () => {
      vi.mocked(db.usageRecord.findFirst).mockResolvedValue(null);
      vi.mocked(db.organization.findUnique).mockResolvedValue({
        plan: "free",
        currentPeriodEnd: null,
      } as never);

      const mockCreatedRecord = {
        id: "new-record",
        tokensUsed: 0,
        tokensAllowance: 50000,
        periodStart: expect.any(Date),
        periodEnd: expect.any(Date),
      };

      vi.mocked(db.usageRecord.create).mockResolvedValue(mockCreatedRecord as never);

      const result = await getOrCreateUsageRecord("org-1");

      expect(result.tokensUsed).toBe(0);
      expect(result.tokensAllowance).toBe(50000);
      expect(db.usageRecord.create).toHaveBeenCalled();
    });

    it("should throw error if organization not found", async () => {
      vi.mocked(db.usageRecord.findFirst).mockResolvedValue(null);
      vi.mocked(db.organization.findUnique).mockResolvedValue(null);

      await expect(getOrCreateUsageRecord("org-1")).rejects.toThrow(
        "Organization not found"
      );
    });
  });

  describe("recordTokenUsage", () => {
    it("should update tokens used and return usage info", async () => {
      const mockRecord = {
        id: "record-1",
        tokensUsed: 10000,
        tokensAllowance: 50000,
        periodStart: new Date(),
        periodEnd: new Date(),
      };

      vi.mocked(db.usageRecord.findFirst).mockResolvedValue(mockRecord);
      vi.mocked(db.usageRecord.update).mockResolvedValue({ ...mockRecord, tokensUsed: 15000 } as never);

      const result = await recordTokenUsage("org-1", 5000);

      expect(result.tokensUsed).toBe(15000);
      expect(result.tokensAllowance).toBe(50000);
      expect(result.percentage).toBe(30);
      expect(result.alertTriggered).toBe(false);
    });

    it("should trigger alert when crossing 80% threshold", async () => {
      const mockRecord = {
        id: "record-1",
        tokensUsed: 39000, // 78%
        tokensAllowance: 50000,
        periodStart: new Date(),
        periodEnd: new Date(),
      };

      vi.mocked(db.usageRecord.findFirst).mockResolvedValue(mockRecord);
      vi.mocked(db.usageRecord.update).mockResolvedValue({ ...mockRecord, tokensUsed: 41000 } as never);

      const result = await recordTokenUsage("org-1", 2000);

      expect(result.tokensUsed).toBe(41000);
      expect(result.percentage).toBe(82);
      expect(result.alertTriggered).toBe(true);
    });

    it("should not trigger alert when already above threshold", async () => {
      const mockRecord = {
        id: "record-1",
        tokensUsed: 45000, // 90%
        tokensAllowance: 50000,
        periodStart: new Date(),
        periodEnd: new Date(),
      };

      vi.mocked(db.usageRecord.findFirst).mockResolvedValue(mockRecord);
      vi.mocked(db.usageRecord.update).mockResolvedValue({ ...mockRecord, tokensUsed: 48000 } as never);

      const result = await recordTokenUsage("org-1", 3000);

      expect(result.alertTriggered).toBe(false);
    });
  });

  describe("getCurrentPeriodUsage", () => {
    it("should return usage summary", async () => {
      const mockRecord = {
        id: "record-1",
        tokensUsed: 25000,
        tokensAllowance: 50000,
        periodStart: new Date("2024-01-01"),
        periodEnd: new Date("2024-02-01"),
      };

      vi.mocked(db.usageRecord.findFirst).mockResolvedValue(mockRecord);
      vi.mocked(db.organization.findUnique).mockResolvedValue({
        plan: "free",
        currentPeriodEnd: null,
      } as never);

      const result = await getCurrentPeriodUsage("org-1");

      expect(result).toEqual({
        tokensUsed: 25000,
        tokensAllowance: 50000,
        percentage: 50,
        remaining: 25000,
        periodStart: mockRecord.periodStart,
        periodEnd: mockRecord.periodEnd,
      });
    });

    it("should return null on error", async () => {
      vi.mocked(db.usageRecord.findFirst).mockRejectedValue(new Error("DB error"));

      const result = await getCurrentPeriodUsage("org-1");

      expect(result).toBeNull();
    });
  });

  describe("checkUsageAllowance", () => {
    it("should allow usage for free tier within allowance", async () => {
      const mockRecord = {
        id: "record-1",
        tokensUsed: 10000,
        tokensAllowance: 50000,
        periodStart: new Date(),
        periodEnd: new Date(),
      };

      vi.mocked(db.usageRecord.findFirst).mockResolvedValue(mockRecord);
      vi.mocked(db.organization.findUnique).mockResolvedValue({ plan: "free" } as never);

      const result = await checkUsageAllowance("org-1", 5000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(40000);
      expect(result.wouldExceed).toBe(false);
    });

    it("should block free tier when over allowance", async () => {
      const mockRecord = {
        id: "record-1",
        tokensUsed: 50000,
        tokensAllowance: 50000,
        periodStart: new Date(),
        periodEnd: new Date(),
      };

      vi.mocked(db.usageRecord.findFirst).mockResolvedValue(mockRecord);
      vi.mocked(db.organization.findUnique).mockResolvedValue({ plan: "free" } as never);

      const result = await checkUsageAllowance("org-1", 1000);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.wouldExceed).toBe(true);
    });

    it("should allow paid tier even when over allowance (overage billing)", async () => {
      const mockRecord = {
        id: "record-1",
        tokensUsed: 500000,
        tokensAllowance: 500000,
        periodStart: new Date(),
        periodEnd: new Date(),
      };

      vi.mocked(db.usageRecord.findFirst).mockResolvedValue(mockRecord);
      vi.mocked(db.organization.findUnique).mockResolvedValue({ plan: "pro" } as never);

      const result = await checkUsageAllowance("org-1", 10000);

      expect(result.allowed).toBe(true);
      expect(result.wouldExceed).toBe(true);
    });
  });

  describe("getUsageStats", () => {
    it("should return current usage, overage, and history", async () => {
      const mockRecord = {
        id: "record-1",
        tokensUsed: 600000, // Over allowance
        tokensAllowance: 500000,
        periodStart: new Date("2024-01-01"),
        periodEnd: new Date("2024-02-01"),
      };

      const mockHistory = [
        {
          periodStart: new Date("2023-12-01"),
          periodEnd: new Date("2024-01-01"),
          tokensUsed: 450000,
          tokensAllowance: 500000,
        },
      ];

      vi.mocked(db.usageRecord.findFirst).mockResolvedValue(mockRecord);
      vi.mocked(db.organization.findUnique).mockResolvedValue({
        plan: "pro",
        currentPeriodEnd: null,
      } as never);
      vi.mocked(db.usageRecord.findMany).mockResolvedValue(mockHistory as never);

      const result = await getUsageStats("org-1");

      expect(result.current).toBeDefined();
      expect(result.overage.tokens).toBe(100000);
      expect(result.overage.cost).toBe(0.1); // $0.10 for 100k tokens
      expect(result.history).toEqual(mockHistory);
    });
  });
});
