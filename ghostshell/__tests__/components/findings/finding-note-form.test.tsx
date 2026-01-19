/**
 * Component tests for FindingNoteForm (Epic 003 - US2)
 * Tests note input, validation, and submission
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FindingNoteForm } from "@/components/findings/finding-note-form";

// Mock server action
vi.mock("@/lib/actions/findings", () => ({
  addFindingNote: vi.fn(),
}));

import { addFindingNote } from "@/lib/actions/findings";

const mockAddFindingNote = vi.mocked(addFindingNote);

describe("FindingNoteForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders textarea with placeholder", () => {
      render(<FindingNoteForm findingId="finding_123" />);

      expect(
        screen.getByPlaceholderText(/add a note about this finding/i)
      ).toBeInTheDocument();
    });

    it("renders character count", () => {
      render(<FindingNoteForm findingId="finding_123" />);

      expect(screen.getByText(/0 \/ 10,000/)).toBeInTheDocument();
    });

    it("renders submit button", () => {
      render(<FindingNoteForm findingId="finding_123" />);

      expect(
        screen.getByRole("button", { name: /add note/i })
      ).toBeInTheDocument();
    });

    it("submit button is disabled when input is empty", () => {
      render(<FindingNoteForm findingId="finding_123" />);

      const submitButton = screen.getByRole("button", { name: /add note/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe("Input Handling", () => {
    it("updates character count as user types", () => {
      render(<FindingNoteForm findingId="finding_123" />);

      const textarea = screen.getByPlaceholderText(
        /add a note about this finding/i
      );
      fireEvent.change(textarea, { target: { value: "Test note" } });

      expect(screen.getByText(/9 \/ 10,000/)).toBeInTheDocument();
    });

    it("enables submit button when content is entered", () => {
      render(<FindingNoteForm findingId="finding_123" />);

      const textarea = screen.getByPlaceholderText(
        /add a note about this finding/i
      );
      fireEvent.change(textarea, { target: { value: "Test note" } });

      const submitButton = screen.getByRole("button", { name: /add note/i });
      expect(submitButton).not.toBeDisabled();
    });

    it("shows error styling when character limit exceeded", () => {
      render(<FindingNoteForm findingId="finding_123" />);

      const textarea = screen.getByPlaceholderText(
        /add a note about this finding/i
      );
      const longContent = "a".repeat(10001);
      fireEvent.change(textarea, { target: { value: longContent } });

      // Character count should show exceeded state
      expect(screen.getByText(/10,001 \/ 10,000/)).toBeInTheDocument();
      // Submit button should be disabled
      const submitButton = screen.getByRole("button", { name: /add note/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe("Form Submission", () => {
    it("shows validation error when submitting empty content", async () => {
      render(<FindingNoteForm findingId="finding_123" />);

      const textarea = screen.getByPlaceholderText(
        /add a note about this finding/i
      );
      // Enter only whitespace
      fireEvent.change(textarea, { target: { value: "   " } });

      const form = textarea.closest("form");
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(
          screen.getByText(/note content cannot be empty/i)
        ).toBeInTheDocument();
      });

      expect(mockAddFindingNote).not.toHaveBeenCalled();
    });

    it("calls addFindingNote on successful submission", async () => {
      mockAddFindingNote.mockResolvedValue({
        id: "note_123",
        content: "Test note content",
        createdAt: new Date(),
      });

      render(<FindingNoteForm findingId="finding_123" />);

      const textarea = screen.getByPlaceholderText(
        /add a note about this finding/i
      );
      fireEvent.change(textarea, { target: { value: "Test note content" } });

      const submitButton = screen.getByRole("button", { name: /add note/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAddFindingNote).toHaveBeenCalledWith(
          "finding_123",
          "Test note content"
        );
      });
    });

    it("clears textarea after successful submission", async () => {
      mockAddFindingNote.mockResolvedValue({
        id: "note_123",
        content: "Test note content",
        createdAt: new Date(),
      });

      render(<FindingNoteForm findingId="finding_123" />);

      const textarea = screen.getByPlaceholderText(
        /add a note about this finding/i
      ) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "Test note content" } });

      const submitButton = screen.getByRole("button", { name: /add note/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(textarea.value).toBe("");
      });
    });

    it("trims whitespace from content before submission", async () => {
      mockAddFindingNote.mockResolvedValue({
        id: "note_123",
        content: "Test note",
        createdAt: new Date(),
      });

      render(<FindingNoteForm findingId="finding_123" />);

      const textarea = screen.getByPlaceholderText(
        /add a note about this finding/i
      );
      fireEvent.change(textarea, { target: { value: "  Test note  " } });

      const submitButton = screen.getByRole("button", { name: /add note/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAddFindingNote).toHaveBeenCalledWith(
          "finding_123",
          "Test note"
        );
      });
    });
  });

  describe("Callbacks", () => {
    it("calls onNoteSubmit immediately with content", async () => {
      mockAddFindingNote.mockResolvedValue({
        id: "note_123",
        content: "Test note",
        createdAt: new Date(),
      });

      const onNoteSubmit = vi.fn();
      render(
        <FindingNoteForm findingId="finding_123" onNoteSubmit={onNoteSubmit} />
      );

      const textarea = screen.getByPlaceholderText(
        /add a note about this finding/i
      );
      fireEvent.change(textarea, { target: { value: "Test note" } });

      const submitButton = screen.getByRole("button", { name: /add note/i });
      fireEvent.click(submitButton);

      // Should be called immediately (optimistic)
      expect(onNoteSubmit).toHaveBeenCalledWith("Test note");
    });

    it("calls onNoteSuccess after successful submission", async () => {
      mockAddFindingNote.mockResolvedValue({
        id: "note_123",
        content: "Test note",
        createdAt: new Date(),
      });

      const onNoteSuccess = vi.fn();
      render(
        <FindingNoteForm
          findingId="finding_123"
          onNoteSuccess={onNoteSuccess}
        />
      );

      const textarea = screen.getByPlaceholderText(
        /add a note about this finding/i
      );
      fireEvent.change(textarea, { target: { value: "Test note" } });

      const submitButton = screen.getByRole("button", { name: /add note/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onNoteSuccess).toHaveBeenCalled();
      });
    });

    it("calls onNoteError on submission failure", async () => {
      mockAddFindingNote.mockRejectedValue(new Error("Failed to add note"));

      const onNoteError = vi.fn();
      render(
        <FindingNoteForm findingId="finding_123" onNoteError={onNoteError} />
      );

      const textarea = screen.getByPlaceholderText(
        /add a note about this finding/i
      );
      fireEvent.change(textarea, { target: { value: "Test note" } });

      const submitButton = screen.getByRole("button", { name: /add note/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onNoteError).toHaveBeenCalled();
      });
    });
  });

  describe("Error Handling", () => {
    it("displays error message on submission failure", async () => {
      mockAddFindingNote.mockRejectedValue(new Error("Network error"));

      render(<FindingNoteForm findingId="finding_123" />);

      const textarea = screen.getByPlaceholderText(
        /add a note about this finding/i
      );
      fireEvent.change(textarea, { target: { value: "Test note" } });

      const submitButton = screen.getByRole("button", { name: /add note/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });

    it("restores content on submission failure", async () => {
      mockAddFindingNote.mockRejectedValue(new Error("Network error"));

      render(<FindingNoteForm findingId="finding_123" />);

      const textarea = screen.getByPlaceholderText(
        /add a note about this finding/i
      ) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "Test note" } });

      const submitButton = screen.getByRole("button", { name: /add note/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(textarea.value).toBe("Test note");
      });
    });

    it("clears error when user starts typing again", async () => {
      mockAddFindingNote.mockRejectedValue(new Error("Network error"));

      render(<FindingNoteForm findingId="finding_123" />);

      const textarea = screen.getByPlaceholderText(
        /add a note about this finding/i
      );
      fireEvent.change(textarea, { target: { value: "Test note" } });

      const submitButton = screen.getByRole("button", { name: /add note/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });

      // Start typing again
      fireEvent.change(textarea, { target: { value: "New note" } });

      expect(screen.queryByText("Network error")).not.toBeInTheDocument();
    });
  });
});
