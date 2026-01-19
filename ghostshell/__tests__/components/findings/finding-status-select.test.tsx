/**
 * Component tests for FindingStatusSelect (Epic 003 - US1)
 * Tests status display, dropdown interaction, and justification modal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FindingStatusSelect } from "@/components/findings/finding-status-select";

// Mock server action
vi.mock("@/lib/actions/findings", () => ({
  updateFindingStatus: vi.fn(),
}));

import { updateFindingStatus } from "@/lib/actions/findings";

const mockUpdateFindingStatus = vi.mocked(updateFindingStatus);

describe("FindingStatusSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders with current status displayed", () => {
      render(
        <FindingStatusSelect findingId="finding_123" currentStatus="open" />
      );

      expect(screen.getByRole("button", { name: /open/i })).toBeInTheDocument();
    });

    it("displays Fixed status with correct styling", () => {
      render(
        <FindingStatusSelect findingId="finding_123" currentStatus="fixed" />
      );

      expect(screen.getByRole("button", { name: /fixed/i })).toBeInTheDocument();
    });

    it("displays Accepted Risk status", () => {
      render(
        <FindingStatusSelect
          findingId="finding_123"
          currentStatus="accepted_risk"
        />
      );

      expect(
        screen.getByRole("button", { name: /accepted risk/i })
      ).toBeInTheDocument();
    });

    it("displays False Positive status", () => {
      render(
        <FindingStatusSelect
          findingId="finding_123"
          currentStatus="false_positive"
        />
      );

      expect(
        screen.getByRole("button", { name: /false positive/i })
      ).toBeInTheDocument();
    });
  });

  describe("Dropdown Interaction", () => {
    it("opens dropdown when button is clicked", async () => {
      render(
        <FindingStatusSelect findingId="finding_123" currentStatus="open" />
      );

      const statusButton = screen.getByRole("button", { name: /open/i });
      fireEvent.click(statusButton);

      await waitFor(() => {
        // Should see all status options in the dropdown
        expect(screen.getByText("Fixed")).toBeInTheDocument();
        expect(screen.getByText("Accepted Risk")).toBeInTheDocument();
        expect(screen.getByText("False Positive")).toBeInTheDocument();
      });
    });

    it("closes dropdown when clicking backdrop", async () => {
      render(
        <FindingStatusSelect findingId="finding_123" currentStatus="open" />
      );

      // Open dropdown
      fireEvent.click(screen.getByRole("button", { name: /open/i }));

      await waitFor(() => {
        expect(screen.getByText("Fixed")).toBeInTheDocument();
      });

      // Click backdrop (the fixed inset-0 div)
      const backdrop = document.querySelector(".fixed.inset-0");
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      // Dropdown should close
      await waitFor(() => {
        expect(screen.queryByText("Fixed")).not.toBeInTheDocument();
      });
    });

    it("shows 'Requires reason' hint for accepted_risk and false_positive", async () => {
      render(
        <FindingStatusSelect findingId="finding_123" currentStatus="open" />
      );

      fireEvent.click(screen.getByRole("button", { name: /open/i }));

      await waitFor(() => {
        // Should show "Requires reason" hint for these statuses
        const hints = screen.getAllByText("Requires reason");
        expect(hints.length).toBe(2); // One for accepted_risk, one for false_positive
      });
    });
  });

  describe("Status Change (No Justification)", () => {
    it("calls updateFindingStatus when selecting 'fixed'", async () => {
      mockUpdateFindingStatus.mockResolvedValue({
        id: "finding_123",
        status: "fixed",
        updatedAt: new Date(),
      });

      const onStatusChange = vi.fn();

      render(
        <FindingStatusSelect
          findingId="finding_123"
          currentStatus="open"
          onStatusChange={onStatusChange}
        />
      );

      // Open dropdown
      fireEvent.click(screen.getByRole("button", { name: /open/i }));

      await waitFor(() => {
        expect(screen.getByText("Fixed")).toBeInTheDocument();
      });

      // Select Fixed
      fireEvent.click(screen.getByText("Fixed"));

      await waitFor(() => {
        expect(mockUpdateFindingStatus).toHaveBeenCalledWith(
          "finding_123",
          "fixed",
          undefined
        );
      });

      // Should call onStatusChange callback
      expect(onStatusChange).toHaveBeenCalledWith("fixed");
    });

    it("does not change status when selecting current status", async () => {
      render(
        <FindingStatusSelect findingId="finding_123" currentStatus="open" />
      );

      // Open dropdown
      fireEvent.click(screen.getByRole("button", { name: /open/i }));

      await waitFor(() => {
        expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
      });

      // Click Open (current status) - should do nothing
      const openOptions = screen.getAllByText("Open");
      fireEvent.click(openOptions[openOptions.length - 1]); // Click the one in dropdown

      expect(mockUpdateFindingStatus).not.toHaveBeenCalled();
    });
  });

  describe("Justification Modal", () => {
    it("shows justification modal when selecting accepted_risk", async () => {
      render(
        <FindingStatusSelect findingId="finding_123" currentStatus="open" />
      );

      // Open dropdown
      fireEvent.click(screen.getByRole("button", { name: /open/i }));

      await waitFor(() => {
        expect(screen.getByText("Accepted Risk")).toBeInTheDocument();
      });

      // Select Accepted Risk
      fireEvent.click(screen.getByText("Accepted Risk"));

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText("Accept Risk")).toBeInTheDocument();
        expect(
          screen.getByPlaceholderText(/risk accepted per security review/i)
        ).toBeInTheDocument();
      });
    });

    it("shows justification modal when selecting false_positive", async () => {
      render(
        <FindingStatusSelect findingId="finding_123" currentStatus="open" />
      );

      // Open dropdown
      fireEvent.click(screen.getByRole("button", { name: /open/i }));

      await waitFor(() => {
        expect(screen.getByText("False Positive")).toBeInTheDocument();
      });

      // Select False Positive
      fireEvent.click(screen.getByText("False Positive"));

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText("Mark as False Positive")).toBeInTheDocument();
        expect(
          screen.getByPlaceholderText(/test environment endpoint/i)
        ).toBeInTheDocument();
      });
    });

    it("requires justification text before submitting", async () => {
      render(
        <FindingStatusSelect findingId="finding_123" currentStatus="open" />
      );

      // Open dropdown and select Accepted Risk
      fireEvent.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("Accepted Risk")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Accepted Risk"));

      // Modal appears
      await waitFor(() => {
        expect(screen.getByText("Accept Risk")).toBeInTheDocument();
      });

      // Confirm button should be disabled without justification
      const confirmButton = screen.getByRole("button", { name: /confirm/i });
      expect(confirmButton).toBeDisabled();
    });

    it("submits with justification when provided", async () => {
      mockUpdateFindingStatus.mockResolvedValue({
        id: "finding_123",
        status: "accepted_risk",
        updatedAt: new Date(),
      });

      render(
        <FindingStatusSelect findingId="finding_123" currentStatus="open" />
      );

      // Open dropdown and select Accepted Risk
      fireEvent.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("Accepted Risk")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Accepted Risk"));

      // Modal appears
      await waitFor(() => {
        expect(screen.getByText("Accept Risk")).toBeInTheDocument();
      });

      // Enter justification
      const textarea = screen.getByPlaceholderText(
        /risk accepted per security review/i
      );
      fireEvent.change(textarea, {
        target: { value: "Risk accepted due to compensating controls" },
      });

      // Confirm button should be enabled now
      const confirmButton = screen.getByRole("button", { name: /confirm/i });
      expect(confirmButton).not.toBeDisabled();

      // Submit
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockUpdateFindingStatus).toHaveBeenCalledWith(
          "finding_123",
          "accepted_risk",
          "Risk accepted due to compensating controls"
        );
      });
    });

    it("closes modal when Cancel is clicked", async () => {
      render(
        <FindingStatusSelect findingId="finding_123" currentStatus="open" />
      );

      // Open dropdown and select Accepted Risk
      fireEvent.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("Accepted Risk")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Accepted Risk"));

      // Modal appears
      await waitFor(() => {
        expect(screen.getByText("Accept Risk")).toBeInTheDocument();
      });

      // Click Cancel
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText("Accept Risk")).not.toBeInTheDocument();
      });

      // Status should remain Open
      expect(screen.getByRole("button", { name: /open/i })).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("shows error message when update fails", async () => {
      mockUpdateFindingStatus.mockRejectedValue(new Error("Update failed"));

      render(
        <FindingStatusSelect findingId="finding_123" currentStatus="open" />
      );

      // Open dropdown
      fireEvent.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("Fixed")).toBeInTheDocument();
      });

      // Select Fixed
      fireEvent.click(screen.getByText("Fixed"));

      // Error should be displayed
      await waitFor(() => {
        expect(screen.getByText("Update failed")).toBeInTheDocument();
      });
    });

    it("rolls back status on error (optimistic update rollback)", async () => {
      mockUpdateFindingStatus.mockRejectedValue(new Error("Network error"));

      const onStatusChange = vi.fn();

      render(
        <FindingStatusSelect
          findingId="finding_123"
          currentStatus="open"
          onStatusChange={onStatusChange}
        />
      );

      // Open dropdown and select Fixed
      fireEvent.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("Fixed")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Fixed"));

      // Should call onStatusChange with "fixed" initially (optimistic)
      expect(onStatusChange).toHaveBeenCalledWith("fixed");

      // After error, should roll back
      await waitFor(() => {
        // onStatusChange should be called again with original status
        expect(onStatusChange).toHaveBeenCalledWith("open");
      });
    });
  });
});
