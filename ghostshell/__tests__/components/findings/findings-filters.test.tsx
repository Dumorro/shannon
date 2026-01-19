/**
 * Component tests for FindingsFilters (Epic 003 - US3)
 * Tests filter dropdowns for severity and status
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FindingsFilters } from "@/components/findings/findings-filters";

describe("FindingsFilters", () => {
  const defaultProps = {
    severity: [] as ("critical" | "high" | "medium" | "low" | "info")[],
    status: [] as ("open" | "fixed" | "accepted_risk" | "false_positive")[],
    onSeverityChange: vi.fn(),
    onStatusChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Severity Filter", () => {
    it("renders severity filter button", () => {
      render(<FindingsFilters {...defaultProps} />);

      expect(screen.getByText("Severity")).toBeInTheDocument();
    });

    it("opens severity dropdown when clicked", async () => {
      render(<FindingsFilters {...defaultProps} />);

      fireEvent.click(screen.getByText("Severity"));

      await waitFor(() => {
        expect(screen.getByText("Critical")).toBeInTheDocument();
        expect(screen.getByText("High")).toBeInTheDocument();
        expect(screen.getByText("Medium")).toBeInTheDocument();
        expect(screen.getByText("Low")).toBeInTheDocument();
        expect(screen.getByText("Info")).toBeInTheDocument();
      });
    });

    it("calls onSeverityChange when severity is selected", async () => {
      const onSeverityChange = vi.fn();
      render(
        <FindingsFilters {...defaultProps} onSeverityChange={onSeverityChange} />
      );

      // Open dropdown
      fireEvent.click(screen.getByText("Severity"));

      await waitFor(() => {
        expect(screen.getByText("Critical")).toBeInTheDocument();
      });

      // Click on Critical checkbox
      const criticalCheckbox = screen.getByRole("checkbox", {
        name: /critical/i,
      });
      fireEvent.click(criticalCheckbox);

      expect(onSeverityChange).toHaveBeenCalledWith(["critical"]);
    });

    it("removes severity when already selected", async () => {
      const onSeverityChange = vi.fn();
      render(
        <FindingsFilters
          {...defaultProps}
          severity={["critical", "high"]}
          onSeverityChange={onSeverityChange}
        />
      );

      // Open dropdown
      fireEvent.click(screen.getByText("Severity"));

      await waitFor(() => {
        expect(screen.getByText("Critical")).toBeInTheDocument();
      });

      // Click on Critical (already selected)
      const criticalCheckbox = screen.getByRole("checkbox", {
        name: /critical/i,
      });
      fireEvent.click(criticalCheckbox);

      expect(onSeverityChange).toHaveBeenCalledWith(["high"]);
    });

    it("shows selected count badge", () => {
      render(
        <FindingsFilters
          {...defaultProps}
          severity={["critical", "high"]}
        />
      );

      // Should show count of selected severities
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  describe("Status Filter", () => {
    it("renders status filter button", () => {
      render(<FindingsFilters {...defaultProps} />);

      expect(screen.getByText("Status")).toBeInTheDocument();
    });

    it("opens status dropdown when clicked", async () => {
      render(<FindingsFilters {...defaultProps} />);

      fireEvent.click(screen.getByText("Status"));

      await waitFor(() => {
        expect(screen.getByText("Open")).toBeInTheDocument();
        expect(screen.getByText("Fixed")).toBeInTheDocument();
        expect(screen.getByText("Accepted Risk")).toBeInTheDocument();
        expect(screen.getByText("False Positive")).toBeInTheDocument();
      });
    });

    it("calls onStatusChange when status is selected", async () => {
      const onStatusChange = vi.fn();
      render(
        <FindingsFilters {...defaultProps} onStatusChange={onStatusChange} />
      );

      // Open dropdown
      fireEvent.click(screen.getByText("Status"));

      await waitFor(() => {
        expect(screen.getByText("Open")).toBeInTheDocument();
      });

      // Click on Open checkbox
      const openCheckbox = screen.getByRole("checkbox", { name: /open/i });
      fireEvent.click(openCheckbox);

      expect(onStatusChange).toHaveBeenCalledWith(["open"]);
    });

    it("removes status when already selected", async () => {
      const onStatusChange = vi.fn();
      render(
        <FindingsFilters
          {...defaultProps}
          status={["open", "fixed"]}
          onStatusChange={onStatusChange}
        />
      );

      // Open dropdown
      fireEvent.click(screen.getByText("Status"));

      await waitFor(() => {
        expect(screen.getByText("Open")).toBeInTheDocument();
      });

      // Click on Open (already selected)
      const openCheckbox = screen.getByRole("checkbox", { name: /open/i });
      fireEvent.click(openCheckbox);

      expect(onStatusChange).toHaveBeenCalledWith(["fixed"]);
    });

    it("shows selected count badge for status", () => {
      render(
        <FindingsFilters
          {...defaultProps}
          status={["open"]}
        />
      );

      // Should show count of selected statuses
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  describe("Multiple Filters", () => {
    it("allows selecting multiple severities", async () => {
      const onSeverityChange = vi.fn();
      const { rerender } = render(
        <FindingsFilters {...defaultProps} onSeverityChange={onSeverityChange} />
      );

      // Open dropdown and select Critical
      fireEvent.click(screen.getByText("Severity"));
      await waitFor(() => {
        expect(screen.getByText("Critical")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("checkbox", { name: /critical/i }));

      expect(onSeverityChange).toHaveBeenCalledWith(["critical"]);

      // Rerender with Critical selected
      rerender(
        <FindingsFilters
          {...defaultProps}
          severity={["critical"]}
          onSeverityChange={onSeverityChange}
        />
      );

      // Select High as well
      fireEvent.click(screen.getByRole("checkbox", { name: /high/i }));

      expect(onSeverityChange).toHaveBeenCalledWith(["critical", "high"]);
    });
  });
});
