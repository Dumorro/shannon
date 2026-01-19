import { describe, it, expect } from "vitest";
import {
  PLAN_CONFIG,
  OVERAGE_RATE_PER_MILLION_TOKENS,
  getPlanLimits,
  hasFeatureAccess,
  getConcurrentScanLimit,
  getTeamMemberLimit,
  getScanDurationLimit,
  getMonthlyTokenAllowance,
  checkTeamMemberLimit,
  checkConcurrentScanLimit,
  checkScanDurationLimit,
  calculateOverageCost,
  getPlanPrice,
  getAnnualSavings,
  formatPrice,
  isPaidPlan,
  isUpgradeablePlan,
  getUpgradePath,
} from "@/lib/billing/plan-limits";

describe("Plan Configuration", () => {
  describe("PLAN_CONFIG", () => {
    it("should have all three plans configured", () => {
      expect(PLAN_CONFIG).toHaveProperty("free");
      expect(PLAN_CONFIG).toHaveProperty("pro");
      expect(PLAN_CONFIG).toHaveProperty("enterprise");
    });

    it("should have correct free plan limits", () => {
      expect(PLAN_CONFIG.free.concurrentScans).toBe(1);
      expect(PLAN_CONFIG.free.teamMembers).toBe(1);
      expect(PLAN_CONFIG.free.scanDurationMinutes).toBe(30);
      expect(PLAN_CONFIG.free.monthlyTokenAllowance).toBe(50_000);
      expect(PLAN_CONFIG.free.monthlyPriceUsd).toBe(0);
    });

    it("should have correct pro plan limits", () => {
      expect(PLAN_CONFIG.pro.concurrentScans).toBe(3);
      expect(PLAN_CONFIG.pro.teamMembers).toBe(5);
      expect(PLAN_CONFIG.pro.scanDurationMinutes).toBe(60);
      expect(PLAN_CONFIG.pro.monthlyTokenAllowance).toBe(500_000);
      expect(PLAN_CONFIG.pro.monthlyPriceUsd).toBe(99_00);
      expect(PLAN_CONFIG.pro.annualPriceUsd).toBe(990_00);
    });

    it("should have correct enterprise plan limits", () => {
      expect(PLAN_CONFIG.enterprise.concurrentScans).toBe(10);
      expect(PLAN_CONFIG.enterprise.teamMembers).toBe(2147483647);
      expect(PLAN_CONFIG.enterprise.scanDurationMinutes).toBe(120);
      expect(PLAN_CONFIG.enterprise.monthlyTokenAllowance).toBe(5_000_000);
    });
  });

  describe("OVERAGE_RATE_PER_MILLION_TOKENS", () => {
    it("should be $1.00 per million tokens", () => {
      expect(OVERAGE_RATE_PER_MILLION_TOKENS).toBe(1.0);
    });
  });
});

describe("Plan Limit Getters", () => {
  describe("getPlanLimits", () => {
    it("should return full config for each plan", () => {
      expect(getPlanLimits("free")).toEqual(PLAN_CONFIG.free);
      expect(getPlanLimits("pro")).toEqual(PLAN_CONFIG.pro);
      expect(getPlanLimits("enterprise")).toEqual(PLAN_CONFIG.enterprise);
    });
  });

  describe("getConcurrentScanLimit", () => {
    it("should return correct limits for each plan", () => {
      expect(getConcurrentScanLimit("free")).toBe(1);
      expect(getConcurrentScanLimit("pro")).toBe(3);
      expect(getConcurrentScanLimit("enterprise")).toBe(10);
    });
  });

  describe("getTeamMemberLimit", () => {
    it("should return correct limits for each plan", () => {
      expect(getTeamMemberLimit("free")).toBe(1);
      expect(getTeamMemberLimit("pro")).toBe(5);
      expect(getTeamMemberLimit("enterprise")).toBe(2147483647);
    });
  });

  describe("getScanDurationLimit", () => {
    it("should return correct duration limits in minutes", () => {
      expect(getScanDurationLimit("free")).toBe(30);
      expect(getScanDurationLimit("pro")).toBe(60);
      expect(getScanDurationLimit("enterprise")).toBe(120);
    });
  });

  describe("getMonthlyTokenAllowance", () => {
    it("should return correct token allowances", () => {
      expect(getMonthlyTokenAllowance("free")).toBe(50_000);
      expect(getMonthlyTokenAllowance("pro")).toBe(500_000);
      expect(getMonthlyTokenAllowance("enterprise")).toBe(5_000_000);
    });
  });
});

describe("Feature Access", () => {
  describe("hasFeatureAccess", () => {
    it("should return false for all features on free plan", () => {
      expect(hasFeatureAccess("free", "customReports")).toBe(false);
      expect(hasFeatureAccess("free", "apiAccess")).toBe(false);
      expect(hasFeatureAccess("free", "scheduledScans")).toBe(false);
    });

    it("should return correct features for pro plan", () => {
      expect(hasFeatureAccess("pro", "customReports")).toBe(true);
      expect(hasFeatureAccess("pro", "apiAccess")).toBe(false);
      expect(hasFeatureAccess("pro", "scheduledScans")).toBe(true);
    });

    it("should return true for all features on enterprise plan", () => {
      expect(hasFeatureAccess("enterprise", "customReports")).toBe(true);
      expect(hasFeatureAccess("enterprise", "apiAccess")).toBe(true);
      expect(hasFeatureAccess("enterprise", "scheduledScans")).toBe(true);
    });
  });
});

describe("Limit Checks", () => {
  describe("checkTeamMemberLimit", () => {
    it("should allow adding within limit", () => {
      const result = checkTeamMemberLimit("pro", 3, 1);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(5);
      expect(result.wouldHave).toBe(4);
    });

    it("should allow adding up to exact limit", () => {
      const result = checkTeamMemberLimit("pro", 4, 1);
      expect(result.allowed).toBe(true);
      expect(result.wouldHave).toBe(5);
    });

    it("should deny adding beyond limit", () => {
      const result = checkTeamMemberLimit("pro", 5, 1);
      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(5);
      expect(result.wouldHave).toBe(6);
    });

    it("should default to adding 1 member", () => {
      const result = checkTeamMemberLimit("free", 1);
      expect(result.allowed).toBe(false);
      expect(result.wouldHave).toBe(2);
    });
  });

  describe("checkConcurrentScanLimit", () => {
    it("should allow scans within limit", () => {
      const result = checkConcurrentScanLimit("pro", 2);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(3);
      expect(result.current).toBe(2);
    });

    it("should deny scans at limit", () => {
      const result = checkConcurrentScanLimit("pro", 3);
      expect(result.allowed).toBe(false);
    });

    it("should allow no scans running for free tier", () => {
      const result = checkConcurrentScanLimit("free", 0);
      expect(result.allowed).toBe(true);
    });

    it("should deny when free tier already has scan running", () => {
      const result = checkConcurrentScanLimit("free", 1);
      expect(result.allowed).toBe(false);
    });
  });

  describe("checkScanDurationLimit", () => {
    it("should allow duration within limit", () => {
      const result = checkScanDurationLimit("pro", 45);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(60);
      expect(result.requested).toBe(45);
    });

    it("should allow duration at exact limit", () => {
      const result = checkScanDurationLimit("pro", 60);
      expect(result.allowed).toBe(true);
    });

    it("should deny duration beyond limit", () => {
      const result = checkScanDurationLimit("pro", 61);
      expect(result.allowed).toBe(false);
    });
  });
});

describe("Pricing Functions", () => {
  describe("calculateOverageCost", () => {
    it("should return 0 when under allowance", () => {
      expect(calculateOverageCost(400_000, 500_000)).toBe(0);
    });

    it("should return 0 when at exact allowance", () => {
      expect(calculateOverageCost(500_000, 500_000)).toBe(0);
    });

    it("should calculate correct overage cost", () => {
      // 1 million tokens over = $1.00
      expect(calculateOverageCost(1_500_000, 500_000)).toBe(1.0);
      // 500k tokens over = $0.50
      expect(calculateOverageCost(1_000_000, 500_000)).toBe(0.5);
      // 2 million tokens over = $2.00
      expect(calculateOverageCost(2_500_000, 500_000)).toBe(2.0);
    });
  });

  describe("getPlanPrice", () => {
    it("should return monthly price for pro monthly", () => {
      expect(getPlanPrice("pro", "monthly")).toBe(99_00);
    });

    it("should return annual price for pro annual", () => {
      expect(getPlanPrice("pro", "annual")).toBe(990_00);
    });

    it("should return 0 for free plan", () => {
      expect(getPlanPrice("free", "monthly")).toBe(0);
    });

    it("should return null for enterprise annual (custom pricing)", () => {
      expect(getPlanPrice("enterprise", "annual")).toBeNull();
    });
  });

  describe("getAnnualSavings", () => {
    it("should return savings for pro plan", () => {
      // 12 * $99 = $1188 - $990 = $198
      expect(getAnnualSavings("pro")).toBe(198_00);
    });

    it("should return null for free plan", () => {
      expect(getAnnualSavings("free")).toBeNull();
    });

    it("should return null for enterprise plan", () => {
      expect(getAnnualSavings("enterprise")).toBeNull();
    });
  });

  describe("formatPrice", () => {
    it("should format cents to dollars", () => {
      expect(formatPrice(99_00)).toBe("$99.00");
      expect(formatPrice(990_00)).toBe("$990.00");
      expect(formatPrice(0)).toBe("$0.00");
      expect(formatPrice(150)).toBe("$1.50");
    });
  });
});

describe("Plan Classification", () => {
  describe("isPaidPlan", () => {
    it("should return false for free plan", () => {
      expect(isPaidPlan("free")).toBe(false);
    });

    it("should return true for pro plan", () => {
      expect(isPaidPlan("pro")).toBe(true);
    });

    it("should return true for enterprise plan", () => {
      expect(isPaidPlan("enterprise")).toBe(true);
    });
  });

  describe("isUpgradeablePlan", () => {
    it("should return true for free plan", () => {
      expect(isUpgradeablePlan("free")).toBe(true);
    });

    it("should return true for pro plan", () => {
      expect(isUpgradeablePlan("pro")).toBe(true);
    });

    it("should return false for enterprise plan", () => {
      expect(isUpgradeablePlan("enterprise")).toBe(false);
    });
  });

  describe("getUpgradePath", () => {
    it("should suggest pro for free tier users", () => {
      expect(getUpgradePath("free")).toBe("pro");
    });

    it("should suggest enterprise for pro tier users", () => {
      expect(getUpgradePath("pro")).toBe("enterprise");
    });

    it("should return null for enterprise users", () => {
      expect(getUpgradePath("enterprise")).toBeNull();
    });
  });
});
