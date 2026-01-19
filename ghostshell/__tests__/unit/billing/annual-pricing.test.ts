import { describe, it, expect } from "vitest";
import {
  PLAN_CONFIG,
  getPlanPrice,
  getAnnualSavings,
  formatPrice,
} from "@/lib/billing/plan-limits";

describe("Annual Pricing", () => {
  describe("Plan Configuration", () => {
    it("should have annual pricing for pro plan", () => {
      expect(PLAN_CONFIG.pro.annualPriceUsd).toBe(990_00);
    });

    it("should have monthly pricing for pro plan", () => {
      expect(PLAN_CONFIG.pro.monthlyPriceUsd).toBe(99_00);
    });

    it("should not have annual pricing for free plan", () => {
      expect(PLAN_CONFIG.free.annualPriceUsd).toBeNull();
    });

    it("should not have annual pricing for enterprise plan (custom)", () => {
      expect(PLAN_CONFIG.enterprise.annualPriceUsd).toBeNull();
    });
  });

  describe("getPlanPrice", () => {
    describe("Monthly pricing", () => {
      it("should return 0 for free plan", () => {
        expect(getPlanPrice("free", "monthly")).toBe(0);
      });

      it("should return $99 for pro plan", () => {
        expect(getPlanPrice("pro", "monthly")).toBe(99_00);
      });

      it("should return 0 for enterprise (custom pricing)", () => {
        expect(getPlanPrice("enterprise", "monthly")).toBe(0);
      });
    });

    describe("Annual pricing", () => {
      it("should return null for free plan", () => {
        expect(getPlanPrice("free", "annual")).toBeNull();
      });

      it("should return $990 for pro plan annual", () => {
        expect(getPlanPrice("pro", "annual")).toBe(990_00);
      });

      it("should return null for enterprise (custom pricing)", () => {
        expect(getPlanPrice("enterprise", "annual")).toBeNull();
      });
    });
  });

  describe("getAnnualSavings", () => {
    it("should return null for free plan", () => {
      expect(getAnnualSavings("free")).toBeNull();
    });

    it("should calculate correct savings for pro plan", () => {
      // Monthly: $99/month * 12 = $1,188
      // Annual: $990
      // Savings: $1,188 - $990 = $198
      expect(getAnnualSavings("pro")).toBe(198_00);
    });

    it("should return null for enterprise (custom pricing)", () => {
      expect(getAnnualSavings("enterprise")).toBeNull();
    });
  });

  describe("Annual vs Monthly Comparison", () => {
    it("should offer 2 months free with annual billing", () => {
      const monthlyTotal = PLAN_CONFIG.pro.monthlyPriceUsd * 12;
      const annualPrice = PLAN_CONFIG.pro.annualPriceUsd!;
      const monthsWorth = monthlyTotal / PLAN_CONFIG.pro.monthlyPriceUsd;
      const effectiveMonths = annualPrice / PLAN_CONFIG.pro.monthlyPriceUsd;

      expect(monthsWorth - effectiveMonths).toBe(2); // 2 months free
    });

    it("should calculate effective monthly rate correctly", () => {
      const annualPrice = PLAN_CONFIG.pro.annualPriceUsd!;
      const effectiveMonthly = annualPrice / 12;

      // $990 / 12 = $82.50/month
      expect(effectiveMonthly).toBe(82_50);
    });

    it("should calculate discount percentage correctly", () => {
      const monthlyTotal = PLAN_CONFIG.pro.monthlyPriceUsd * 12;
      const annualPrice = PLAN_CONFIG.pro.annualPriceUsd!;
      const discountPercentage = Math.round(
        ((monthlyTotal - annualPrice) / monthlyTotal) * 100
      );

      // ($1188 - $990) / $1188 = 16.67% ≈ 17%
      expect(discountPercentage).toBeGreaterThanOrEqual(16);
      expect(discountPercentage).toBeLessThanOrEqual(17);
    });
  });

  describe("formatPrice", () => {
    it("should format monthly price correctly", () => {
      expect(formatPrice(99_00)).toBe("$99.00");
    });

    it("should format annual price correctly", () => {
      expect(formatPrice(990_00)).toBe("$990.00");
    });

    it("should format savings correctly", () => {
      expect(formatPrice(198_00)).toBe("$198.00");
    });

    it("should handle zero price", () => {
      expect(formatPrice(0)).toBe("$0.00");
    });

    it("should handle cents correctly", () => {
      expect(formatPrice(82_50)).toBe("$82.50");
    });
  });

  describe("Billing Period Calculations", () => {
    it("should calculate days in annual period", () => {
      const annualDays = 365;
      const monthlyDays = 30;
      expect(annualDays / monthlyDays).toBeGreaterThan(12);
    });

    it("should provide better value per day for annual", () => {
      const monthlyPrice = PLAN_CONFIG.pro.monthlyPriceUsd;
      const annualPrice = PLAN_CONFIG.pro.annualPriceUsd!;

      const monthlyPerDay = monthlyPrice / 30;
      const annualPerDay = annualPrice / 365;

      expect(annualPerDay).toBeLessThan(monthlyPerDay);
    });
  });
});
