/**
 * Component tests for FindingDetail (Epic 003 - US1)
 * Tests rendering of finding information and navigation links
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FindingDetail } from "@/components/findings/finding-detail";
import type { FindingDetail as FindingDetailType } from "@/lib/types/findings";

// Mock child components
vi.mock("@/components/findings/finding-status-select", () => ({
  FindingStatusSelect: ({ currentStatus }: { currentStatus: string }) => (
    <div data-testid="finding-status-select">Status: {currentStatus}</div>
  ),
}));

vi.mock("@/components/findings/evidence-display", () => ({
  EvidenceDisplay: ({ evidence }: { evidence: unknown }) => (
    <div data-testid="evidence-display">
      {evidence ? "Evidence data present" : "No evidence"}
    </div>
  ),
}));

vi.mock("@/components/findings/finding-activity", () => ({
  FindingActivity: ({ findingId }: { findingId: string }) => (
    <div data-testid="finding-activity">Activity for: {findingId}</div>
  ),
}));

vi.mock("@/components/severity-badge", () => ({
  SeverityBadge: ({
    severity,
    size,
  }: {
    severity: string;
    size?: string;
  }) => (
    <span data-testid="severity-badge" data-size={size}>
      {severity}
    </span>
  ),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const createMockFinding = (
  overrides?: Partial<FindingDetailType>
): FindingDetailType => ({
  id: "finding_123",
  scanId: "scan_456",
  title: "SQL Injection in Login Form",
  description:
    "A SQL injection vulnerability was found in the login endpoint. An attacker could bypass authentication.",
  severity: "critical",
  category: "injection",
  status: "open",
  cvss: 9.8,
  cwe: "CWE-89",
  remediation: "Use parameterized queries or prepared statements.",
  evidence: {
    steps: ["Navigate to login page", "Enter payload"],
    payloads: ["' OR 1=1--"],
    proofOfImpact: "Logged in as admin",
  },
  createdAt: new Date("2026-01-15T10:00:00Z"),
  updatedAt: new Date("2026-01-16T14:30:00Z"),
  scan: {
    id: "scan_456",
    targetUrl: "https://example.com",
    projectName: "Example Project",
  },
  ...overrides,
});

describe("FindingDetail", () => {
  describe("Header Section", () => {
    it("renders back to scan link", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      const backLink = screen.getByRole("link", { name: /back to scan/i });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute("href", "/dashboard/scans/scan_456");
    });

    it("renders finding title", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      expect(
        screen.getByRole("heading", { name: /sql injection in login form/i })
      ).toBeInTheDocument();
    });

    it("renders severity badge with large size", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      const severityBadge = screen.getAllByTestId("severity-badge")[0];
      expect(severityBadge).toHaveAttribute("data-size", "lg");
      expect(severityBadge).toHaveTextContent("critical");
    });

    it("renders target URL", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      expect(screen.getByText("https://example.com")).toBeInTheDocument();
    });

    it("renders project name when available", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      expect(screen.getByText("Example Project")).toBeInTheDocument();
    });

    it("does not render project name when not available", () => {
      const finding = createMockFinding({
        scan: {
          id: "scan_456",
          targetUrl: "https://example.com",
          projectName: undefined,
        },
      });
      render(<FindingDetail finding={finding} />);

      expect(screen.queryByText("Example Project")).not.toBeInTheDocument();
    });

    it("renders FindingStatusSelect with correct props", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      const statusSelect = screen.getByTestId("finding-status-select");
      expect(statusSelect).toHaveTextContent("Status: open");
    });
  });

  describe("Description Section", () => {
    it("renders description heading", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      expect(
        screen.getByRole("heading", { name: /description/i })
      ).toBeInTheDocument();
    });

    it("renders description content", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      expect(
        screen.getByText(/sql injection vulnerability was found/i)
      ).toBeInTheDocument();
    });
  });

  describe("Evidence Section", () => {
    it("renders evidence heading", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      expect(
        screen.getByRole("heading", { name: /evidence/i })
      ).toBeInTheDocument();
    });

    it("renders EvidenceDisplay component with evidence", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      const evidenceDisplay = screen.getByTestId("evidence-display");
      expect(evidenceDisplay).toHaveTextContent("Evidence data present");
    });

    it("renders EvidenceDisplay with no evidence", () => {
      const finding = createMockFinding({ evidence: null });
      render(<FindingDetail finding={finding} />);

      const evidenceDisplay = screen.getByTestId("evidence-display");
      expect(evidenceDisplay).toHaveTextContent("No evidence");
    });
  });

  describe("Remediation Section", () => {
    it("renders remediation guidance when available", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      expect(
        screen.getByRole("heading", { name: /remediation guidance/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/use parameterized queries/i)
      ).toBeInTheDocument();
    });

    it("does not render remediation section when not available", () => {
      const finding = createMockFinding({ remediation: null });
      render(<FindingDetail finding={finding} />);

      expect(
        screen.queryByRole("heading", { name: /remediation guidance/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Technical Details Section", () => {
    it("renders category", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      expect(screen.getByText("Category")).toBeInTheDocument();
      expect(screen.getByText("injection")).toBeInTheDocument();
    });

    it("renders CWE reference with link", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      expect(screen.getByText("CWE Reference")).toBeInTheDocument();
      const cweLink = screen.getByRole("link", { name: /cwe-89/i });
      expect(cweLink).toHaveAttribute(
        "href",
        "https://cwe.mitre.org/data/definitions/89.html"
      );
      expect(cweLink).toHaveAttribute("target", "_blank");
    });

    it("does not render CWE when not available", () => {
      const finding = createMockFinding({ cwe: null });
      render(<FindingDetail finding={finding} />);

      expect(screen.queryByText("CWE Reference")).not.toBeInTheDocument();
    });

    it("renders CVSS score", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      expect(screen.getByText("CVSS Score")).toBeInTheDocument();
      expect(screen.getByText("9.8")).toBeInTheDocument();
      expect(screen.getByText("(Critical)")).toBeInTheDocument();
    });

    it("does not render CVSS when not available", () => {
      const finding = createMockFinding({ cvss: null });
      render(<FindingDetail finding={finding} />);

      expect(screen.queryByText("CVSS Score")).not.toBeInTheDocument();
    });
  });

  describe("Timeline Section", () => {
    it("renders discovered date", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      expect(screen.getByText("Discovered")).toBeInTheDocument();
      // Date format may vary by locale, so just check it renders something
      expect(screen.getByText(/jan.*15.*2026/i)).toBeInTheDocument();
    });

    it("renders last updated date", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      expect(screen.getByText("Last Updated")).toBeInTheDocument();
      expect(screen.getByText(/jan.*16.*2026/i)).toBeInTheDocument();
    });
  });

  describe("Source Scan Section", () => {
    it("renders link to source scan", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      expect(
        screen.getByRole("heading", { name: /source scan/i })
      ).toBeInTheDocument();
      const scanLink = screen.getByRole("link", { name: /view scan details/i });
      expect(scanLink).toHaveAttribute("href", "/dashboard/scans/scan_456");
    });
  });

  describe("Activity Section", () => {
    it("renders FindingActivity component", () => {
      const finding = createMockFinding();
      render(<FindingDetail finding={finding} />);

      const activitySection = screen.getByTestId("finding-activity");
      expect(activitySection).toHaveTextContent("Activity for: finding_123");
    });
  });

  describe("Different Severities", () => {
    it.each(["critical", "high", "medium", "low", "info"] as const)(
      "renders %s severity correctly",
      (severity) => {
        const finding = createMockFinding({ severity });
        render(<FindingDetail finding={finding} />);

        const severityBadges = screen.getAllByTestId("severity-badge");
        expect(severityBadges[0]).toHaveTextContent(severity);
      }
    );
  });

  describe("Different Statuses", () => {
    it.each(["open", "fixed", "accepted_risk", "false_positive"] as const)(
      "renders %s status correctly",
      (status) => {
        const finding = createMockFinding({ status });
        render(<FindingDetail finding={finding} />);

        const statusSelect = screen.getByTestId("finding-status-select");
        expect(statusSelect).toHaveTextContent(`Status: ${status}`);
      }
    );
  });
});
