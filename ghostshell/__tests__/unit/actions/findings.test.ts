/**
 * Unit tests for findings server actions (Epic 003 - Findings & Remediation)
 * Tests getFinding, updateFindingStatus, addFindingNote, getFindingActivity,
 * listFindings, getFindingsSummary, and bulkUpdateFindingStatus
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock modules using factory functions
vi.mock("@/lib/db", () => ({
  db: {
    finding: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    findingNote: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    organizationMembership: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  hasOrgAccess: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Import modules after mocks are set up
import { db } from "@/lib/db";
import { getCurrentUser, hasOrgAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";

import {
  getFinding,
  updateFindingStatus,
  addFindingNote,
  getFindingActivity,
  listFindings,
  getFindingsSummary,
  bulkUpdateFindingStatus,
} from "@/lib/actions/findings";

// Get typed mock references
const mockDb = vi.mocked(db);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockHasOrgAccess = vi.mocked(hasOrgAccess);
const mockRevalidatePath = vi.mocked(revalidatePath);

// Test fixtures
const mockUser = {
  id: "user_123",
  name: "Test User",
  email: "test@example.com",
  avatarUrl: null,
};

const mockFinding = {
  id: "finding_123",
  scanId: "scan_456",
  title: "SQL Injection in Login",
  description: "SQL injection vulnerability found in login endpoint",
  severity: "critical",
  category: "injection",
  status: "open",
  cvss: 9.8,
  cwe: "CWE-89",
  remediation: "Use parameterized queries",
  evidence: { steps: ["Step 1", "Step 2"], payloads: ["' OR 1=1--"] },
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
  scan: {
    id: "scan_456",
    organizationId: "org_789",
    project: {
      name: "Test Project",
      targetUrl: "https://example.com",
    },
  },
};

describe("findings server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFinding", () => {
    it("returns null when user is not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getFinding("finding_123");

      expect(result).toBeNull();
      expect(mockDb.finding.findUnique).not.toHaveBeenCalled();
    });

    it("returns null when finding does not exist", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.finding.findUnique.mockResolvedValue(null);

      const result = await getFinding("nonexistent");

      expect(result).toBeNull();
    });

    it("returns null when user lacks org access", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.finding.findUnique.mockResolvedValue(mockFinding as never);
      mockHasOrgAccess.mockResolvedValue(false);

      const result = await getFinding("finding_123");

      expect(result).toBeNull();
      expect(mockHasOrgAccess).toHaveBeenCalledWith("org_789");
    });

    it("returns finding detail when authorized", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.finding.findUnique.mockResolvedValue(mockFinding as never);
      mockHasOrgAccess.mockResolvedValue(true);

      const result = await getFinding("finding_123");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("finding_123");
      expect(result?.title).toBe("SQL Injection in Login");
      expect(result?.severity).toBe("critical");
      expect(result?.scan.projectName).toBe("Test Project");
    });
  });

  describe("updateFindingStatus", () => {
    it("throws when user is not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      await expect(updateFindingStatus("finding_123", "fixed")).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("throws when finding does not exist", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.finding.findUnique.mockResolvedValue(null);

      await expect(updateFindingStatus("nonexistent", "fixed")).rejects.toThrow(
        "Finding not found"
      );
    });

    it("throws when user lacks org access", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.finding.findUnique.mockResolvedValue(mockFinding as never);
      mockHasOrgAccess.mockResolvedValue(false);

      await expect(
        updateFindingStatus("finding_123", "fixed")
      ).rejects.toThrow("Unauthorized");
    });

    it("throws when justification required but not provided", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.finding.findUnique.mockResolvedValue(mockFinding as never);
      mockHasOrgAccess.mockResolvedValue(true);

      await expect(
        updateFindingStatus("finding_123", "accepted_risk")
      ).rejects.toThrow("Justification required");
    });

    it("updates status to fixed without justification", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.finding.findUnique.mockResolvedValue(mockFinding as never);
      mockHasOrgAccess.mockResolvedValue(true);

      const updatedFinding = {
        ...mockFinding,
        status: "fixed",
        updatedAt: new Date(),
      };

      mockDb.$transaction.mockImplementation(async (fn) => {
        return fn({
          finding: {
            update: vi.fn().mockResolvedValue(updatedFinding),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await updateFindingStatus("finding_123", "fixed");

      expect(result.status).toBe("fixed");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        "/dashboard/findings/finding_123"
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/findings");
    });

    it("updates status to accepted_risk with justification", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.finding.findUnique.mockResolvedValue(mockFinding as never);
      mockHasOrgAccess.mockResolvedValue(true);

      const updatedFinding = {
        ...mockFinding,
        status: "accepted_risk",
        updatedAt: new Date(),
      };

      mockDb.$transaction.mockImplementation(async (fn) => {
        return fn({
          finding: {
            update: vi.fn().mockResolvedValue(updatedFinding),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await updateFindingStatus(
        "finding_123",
        "accepted_risk",
        "Risk accepted per security review"
      );

      expect(result.status).toBe("accepted_risk");
    });
  });

  describe("addFindingNote", () => {
    it("throws when user is not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      await expect(
        addFindingNote("finding_123", "Test note")
      ).rejects.toThrow("Unauthorized");
    });

    it("throws when content is empty", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      await expect(addFindingNote("finding_123", "   ")).rejects.toThrow(
        "Note content cannot be empty"
      );
    });

    it("throws when content exceeds 10000 characters", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      const longContent = "a".repeat(10001);

      await expect(
        addFindingNote("finding_123", longContent)
      ).rejects.toThrow("exceeds maximum length");
    });

    it("throws when finding does not exist", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.finding.findUnique.mockResolvedValue(null);

      await expect(
        addFindingNote("nonexistent", "Test note")
      ).rejects.toThrow("Finding not found");
    });

    it("creates note when authorized", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.finding.findUnique.mockResolvedValue(mockFinding as never);
      mockHasOrgAccess.mockResolvedValue(true);

      const mockNote = {
        id: "note_123",
        content: "Test note content",
        createdAt: new Date(),
      };

      mockDb.$transaction.mockImplementation(async (fn) => {
        return fn({
          findingNote: {
            create: vi.fn().mockResolvedValue(mockNote),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await addFindingNote("finding_123", "Test note content");

      expect(result.id).toBe("note_123");
      expect(result.content).toBe("Test note content");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        "/dashboard/findings/finding_123"
      );
    });
  });

  describe("getFindingActivity", () => {
    it("returns empty array when user is not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getFindingActivity("finding_123");

      expect(result).toEqual([]);
    });

    it("returns empty array when finding does not exist", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.finding.findUnique.mockResolvedValue(null);

      const result = await getFindingActivity("nonexistent");

      expect(result).toEqual([]);
    });

    it("returns merged activity timeline", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.finding.findUnique.mockResolvedValue(mockFinding as never);
      mockHasOrgAccess.mockResolvedValue(true);

      const mockNotes = [
        {
          id: "note_1",
          content: "Note content",
          createdAt: new Date("2026-01-16"),
          user: mockUser,
        },
      ];

      const mockAuditLogs = [
        {
          id: "audit_1",
          createdAt: new Date("2026-01-15"),
          user: mockUser,
          metadata: {
            previousStatus: "open",
            newStatus: "fixed",
            justification: null,
          },
        },
      ];

      mockDb.findingNote.findMany.mockResolvedValue(mockNotes as never);
      mockDb.auditLog.findMany.mockResolvedValue(mockAuditLogs as never);

      const result = await getFindingActivity("finding_123");

      expect(result).toHaveLength(2);
      // Sorted by date (newest first)
      expect(result[0].type).toBe("note");
      expect(result[1].type).toBe("status_change");
    });
  });

  describe("listFindings", () => {
    it("returns empty response when user is not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await listFindings();

      expect(result).toEqual({ findings: [], nextCursor: null, total: 0 });
    });

    it("returns empty response when user has no org membership", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.organizationMembership.findFirst.mockResolvedValue(null);

      const result = await listFindings();

      expect(result).toEqual({ findings: [], nextCursor: null, total: 0 });
    });

    it("returns findings list with pagination", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.organizationMembership.findFirst.mockResolvedValue({
        organizationId: "org_789",
      } as never);
      mockDb.finding.count.mockResolvedValue(1);
      mockDb.finding.findMany.mockResolvedValue([mockFinding] as never);

      const result = await listFindings();

      expect(result.findings).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("applies severity filter", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.organizationMembership.findFirst.mockResolvedValue({
        organizationId: "org_789",
      } as never);
      mockDb.finding.count.mockResolvedValue(1);
      mockDb.finding.findMany.mockResolvedValue([mockFinding] as never);

      await listFindings({ severity: ["critical", "high"] });

      expect(mockDb.finding.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            severity: { in: ["critical", "high"] },
          }),
        })
      );
    });

    it("applies status filter", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.organizationMembership.findFirst.mockResolvedValue({
        organizationId: "org_789",
      } as never);
      mockDb.finding.count.mockResolvedValue(1);
      mockDb.finding.findMany.mockResolvedValue([mockFinding] as never);

      await listFindings({ status: "open" });

      expect(mockDb.finding.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "open",
          }),
        })
      );
    });

    it("applies search filter", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.organizationMembership.findFirst.mockResolvedValue({
        organizationId: "org_789",
      } as never);
      mockDb.finding.count.mockResolvedValue(1);
      mockDb.finding.findMany.mockResolvedValue([mockFinding] as never);

      await listFindings({ search: "sql" });

      expect(mockDb.finding.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { title: { contains: "sql", mode: "insensitive" } },
            ]),
          }),
        })
      );
    });
  });

  describe("getFindingsSummary", () => {
    it("returns empty summary when user is not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getFindingsSummary();

      expect(result.total).toBe(0);
      expect(result.openCount).toBe(0);
    });

    it("returns summary with counts", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.organizationMembership.findFirst.mockResolvedValue({
        organizationId: "org_789",
      } as never);
      mockDb.finding.findMany.mockResolvedValue([
        { severity: "critical", status: "open" },
        { severity: "high", status: "open" },
        { severity: "medium", status: "fixed" },
      ] as never);

      const result = await getFindingsSummary();

      expect(result.total).toBe(3);
      expect(result.bySeverity.critical).toBe(1);
      expect(result.bySeverity.high).toBe(1);
      expect(result.byStatus.open).toBe(2);
      expect(result.byStatus.fixed).toBe(1);
      expect(result.openCount).toBe(2);
    });
  });

  describe("bulkUpdateFindingStatus", () => {
    it("throws when user is not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      await expect(
        bulkUpdateFindingStatus(["finding_1"], "fixed")
      ).rejects.toThrow("Unauthorized");
    });

    it("throws when no findings selected", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);

      await expect(bulkUpdateFindingStatus([], "fixed")).rejects.toThrow(
        "No findings selected"
      );
    });

    it("throws when more than 50 findings selected", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      const manyIds = Array.from({ length: 51 }, (_, i) => `finding_${i}`);

      await expect(bulkUpdateFindingStatus(manyIds, "fixed")).rejects.toThrow(
        "Cannot update more than 50 findings"
      );
    });

    it("throws when justification required but not provided", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.organizationMembership.findFirst.mockResolvedValue({
        organizationId: "org_789",
      } as never);

      await expect(
        bulkUpdateFindingStatus(["finding_1"], "accepted_risk")
      ).rejects.toThrow("Justification required");
    });

    it("throws when some findings not found", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.organizationMembership.findFirst.mockResolvedValue({
        organizationId: "org_789",
      } as never);
      mockDb.finding.findMany.mockResolvedValue([mockFinding] as never);

      await expect(
        bulkUpdateFindingStatus(["finding_1", "finding_2"], "fixed")
      ).rejects.toThrow("Some findings not found");
    });

    it("updates multiple findings successfully", async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockDb.organizationMembership.findFirst.mockResolvedValue({
        organizationId: "org_789",
      } as never);
      mockDb.finding.findMany.mockResolvedValue([
        { ...mockFinding, id: "finding_1" },
        { ...mockFinding, id: "finding_2" },
      ] as never);

      mockDb.$transaction.mockImplementation(async (fn) => {
        return fn({
          finding: {
            updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
          auditLog: {
            createMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
        });
      });

      const result = await bulkUpdateFindingStatus(
        ["finding_1", "finding_2"],
        "fixed"
      );

      expect(result.updated).toBe(2);
      expect(result.findingIds).toEqual(["finding_1", "finding_2"]);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/findings");
    });
  });
});
