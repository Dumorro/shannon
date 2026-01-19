import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("@/lib/db", () => ({
  db: {
    organization: {
      findUnique: vi.fn(),
    },
    scan: {
      count: vi.fn(),
    },
    membership: {
      count: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  checkConcurrentScanLimit,
  checkTeamMemberLimit,
  checkScanDurationLimit,
  hasFeatureAccess,
  getConcurrentScanLimit,
  getTeamMemberLimit,
  getScanDurationLimit,
} from "@/lib/billing/plan-limits";

describe("Plan Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Concurrent Scan Limits", () => {
    it("should allow scans within free tier limit", () => {
      const result = checkConcurrentScanLimit("free", 0);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1);
    });

    it("should block additional scans at free tier limit", () => {
      const result = checkConcurrentScanLimit("free", 1);
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(1);
    });

    it("should allow multiple scans for pro tier", () => {
      const result = checkConcurrentScanLimit("pro", 2);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(3);
    });

    it("should block at pro tier limit", () => {
      const result = checkConcurrentScanLimit("pro", 3);
      expect(result.allowed).toBe(false);
    });

    it("should allow up to 10 concurrent scans for enterprise", () => {
      const result = checkConcurrentScanLimit("enterprise", 9);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
    });

    it("should return correct limits for each tier", () => {
      expect(getConcurrentScanLimit("free")).toBe(1);
      expect(getConcurrentScanLimit("pro")).toBe(3);
      expect(getConcurrentScanLimit("enterprise")).toBe(10);
    });
  });

  describe("Team Member Limits", () => {
    it("should block additional team members on free tier", () => {
      const result = checkTeamMemberLimit("free", 1);
      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(1);
    });

    it("should allow adding team members within pro tier limit", () => {
      const result = checkTeamMemberLimit("pro", 3, 1);
      expect(result.allowed).toBe(true);
      expect(result.wouldHave).toBe(4);
    });

    it("should block when adding would exceed pro tier limit", () => {
      const result = checkTeamMemberLimit("pro", 5, 1);
      expect(result.allowed).toBe(false);
      expect(result.wouldHave).toBe(6);
    });

    it("should allow virtually unlimited members for enterprise", () => {
      const result = checkTeamMemberLimit("enterprise", 1000, 100);
      expect(result.allowed).toBe(true);
    });

    it("should return correct limits for each tier", () => {
      expect(getTeamMemberLimit("free")).toBe(1);
      expect(getTeamMemberLimit("pro")).toBe(5);
      expect(getTeamMemberLimit("enterprise")).toBe(2147483647);
    });
  });

  describe("Scan Duration Limits", () => {
    it("should allow short scans on free tier", () => {
      const result = checkScanDurationLimit("free", 20);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(30);
    });

    it("should block long scans on free tier", () => {
      const result = checkScanDurationLimit("free", 45);
      expect(result.allowed).toBe(false);
      expect(result.requested).toBe(45);
    });

    it("should allow 60-minute scans on pro tier", () => {
      const result = checkScanDurationLimit("pro", 60);
      expect(result.allowed).toBe(true);
    });

    it("should allow 2-hour scans on enterprise tier", () => {
      const result = checkScanDurationLimit("enterprise", 120);
      expect(result.allowed).toBe(true);
    });

    it("should return correct limits for each tier", () => {
      expect(getScanDurationLimit("free")).toBe(30);
      expect(getScanDurationLimit("pro")).toBe(60);
      expect(getScanDurationLimit("enterprise")).toBe(120);
    });
  });

  describe("Feature Access", () => {
    describe("Free tier features", () => {
      it("should not have custom reports", () => {
        expect(hasFeatureAccess("free", "customReports")).toBe(false);
      });

      it("should not have API access", () => {
        expect(hasFeatureAccess("free", "apiAccess")).toBe(false);
      });

      it("should not have scheduled scans", () => {
        expect(hasFeatureAccess("free", "scheduledScans")).toBe(false);
      });
    });

    describe("Pro tier features", () => {
      it("should have custom reports", () => {
        expect(hasFeatureAccess("pro", "customReports")).toBe(true);
      });

      it("should not have API access", () => {
        expect(hasFeatureAccess("pro", "apiAccess")).toBe(false);
      });

      it("should have scheduled scans", () => {
        expect(hasFeatureAccess("pro", "scheduledScans")).toBe(true);
      });
    });

    describe("Enterprise tier features", () => {
      it("should have all features", () => {
        expect(hasFeatureAccess("enterprise", "customReports")).toBe(true);
        expect(hasFeatureAccess("enterprise", "apiAccess")).toBe(true);
        expect(hasFeatureAccess("enterprise", "scheduledScans")).toBe(true);
      });
    });
  });
});
