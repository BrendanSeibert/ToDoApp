import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@solidjs/testing-library";
import en from "~/i18n/en.json";
import { ApiError } from "~/api/client";
import { renderWithI18n } from "../helpers/renderWithI18n";

vi.mock("~/api/auth", () => ({
  logout: vi.fn(),
  deleteAccount: vi.fn(),
}));

const mockedSetCurrentUser = vi.fn();
const mockedUser = vi.fn(() => ({ id: "u1", email: "a@example.com", createdAt: "now" }));
vi.mock("~/context/AuthContext", () => ({
  useAuth: () => ({ user: mockedUser, setCurrentUser: mockedSetCurrentUser }),
}));

import { deleteAccount, logout } from "~/api/auth";
import AccountSettings from "~/components/AccountSettings";

const mockedLogout = logout as unknown as ReturnType<typeof vi.fn>;
const mockedDeleteAccount = deleteAccount as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedLogout.mockReset();
  mockedDeleteAccount.mockReset();
  mockedSetCurrentUser.mockReset();
  mockedUser.mockReturnValue({ id: "u1", email: "a@example.com", createdAt: "now" });
});

describe("AccountSettings", () => {
  it("shows the user's email", () => {
    renderWithI18n(() => <AccountSettings />);
    expect(screen.getByText("a@example.com")).toBeInTheDocument();
  });

  it("logs out and clears the current user", async () => {
    mockedLogout.mockResolvedValue({ ok: true });
    renderWithI18n(() => <AccountSettings />);

    await fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(mockedLogout).toHaveBeenCalled();
    expect(mockedSetCurrentUser).toHaveBeenCalledWith(null);
  });

  it("requires confirmation before deleting the account", async () => {
    mockedDeleteAccount.mockResolvedValue({ ok: true });
    renderWithI18n(() => <AccountSettings />);

    await fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    expect(mockedDeleteAccount).not.toHaveBeenCalled();

    await fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(mockedDeleteAccount).toHaveBeenCalled();
    expect(mockedSetCurrentUser).toHaveBeenCalledWith(null);
  });

  it("cancels the delete confirmation without deleting", async () => {
    renderWithI18n(() => <AccountSettings />);

    await fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();
    expect(mockedDeleteAccount).not.toHaveBeenCalled();
  });

  describe("delete confirmation dialog", () => {
    const openDialog = () => fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = () => screen.queryByRole("alertdialog", { name: "Delete account" });

    it("is closed until Delete account is clicked, then shows the message and buttons", async () => {
      renderWithI18n(() => <AccountSettings />);
      expect(dialog()).not.toBeInTheDocument();

      await openDialog();

      expect(dialog()).toBeInTheDocument();
      expect(dialog()).toHaveTextContent(en.account.deleteConfirmation);
      expect(screen.getByRole("alertdialog", { name: "Delete account", description: en.account.deleteConfirmation })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirm delete" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("does not add the confirmation to the account settings bar", async () => {
      const { container } = renderWithI18n(() => <AccountSettings />);

      await openDialog();

      expect(container).not.toHaveTextContent(en.account.deleteConfirmation);
    });

    it.each([
      ["Cancel", () => fireEvent.click(screen.getByRole("button", { name: "Cancel" }))],
      ["the close button", () => fireEvent.click(screen.getByRole("button", { name: "Close" }))],
      ["Escape", () => fireEvent.keyDown(document, { key: "Escape" })],
      ["a press outside the dialog", () => fireEvent.mouseDown(screen.getByRole("alertdialog").parentElement!)],
    ])("closes without deleting on %s", async (_label, dismiss) => {
      renderWithI18n(() => <AccountSettings />);
      await openDialog();

      await dismiss();

      expect(dialog()).not.toBeInTheDocument();
      expect(mockedDeleteAccount).not.toHaveBeenCalled();
      expect(mockedSetCurrentUser).not.toHaveBeenCalled();
    });

    it("shows a failure inside the dialog and keeps it open", async () => {
      mockedDeleteAccount.mockRejectedValue(new ApiError(500, "Server down"));
      renderWithI18n(() => <AccountSettings />);
      await openDialog();

      await fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

      expect(await within(screen.getByRole("alertdialog")).findByRole("alert")).toHaveTextContent("Server down");
      expect(screen.getAllByRole("alert")).toHaveLength(1);
    });

    it("forgets a failure when the dialog is closed and reopened", async () => {
      mockedDeleteAccount.mockRejectedValue(new Error("boom"));
      renderWithI18n(() => <AccountSettings />);
      await openDialog();
      await fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
      await screen.findByRole("alert");

      await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await openDialog();

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("starts with focus on Cancel, the safe choice", async () => {
      renderWithI18n(() => <AccountSettings />);

      await openDialog();

      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    });

    it("returns focus to the Delete account button when cancelled", async () => {
      renderWithI18n(() => <AccountSettings />);
      const opener = screen.getByRole("button", { name: "Delete account" });
      opener.focus();
      await fireEvent.click(opener);

      await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(opener).toHaveFocus();
    });

    describe("while the delete request is in flight", () => {
      let resolve!: (value: unknown) => void;
      let reject!: (reason: unknown) => void;
      const startDelete = async () => {
        mockedDeleteAccount.mockReturnValue(
          new Promise((res, rej) => {
            resolve = res;
            reject = rej;
          }),
        );
        renderWithI18n(() => <AccountSettings />);
        await openDialog();
        await fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
      };

      it("cannot be dismissed by Cancel, Close, Escape or the backdrop", async () => {
        await startDelete();

        expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
        await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        await fireEvent.keyDown(document, { key: "Escape" });
        await fireEvent.mouseDown(screen.getByRole("alertdialog").parentElement!);

        expect(dialog()).toBeInTheDocument();
        resolve({ ok: true });
        await waitFor(() => expect(mockedSetCurrentUser).toHaveBeenCalledWith(null));
      });

      it("announces the progress through a status region", async () => {
        renderWithI18n(() => <AccountSettings />);
        mockedDeleteAccount.mockReturnValue(
          new Promise((res) => {
            resolve = res;
          }),
        );
        await openDialog();
        const status = within(screen.getByRole("alertdialog")).getByRole("status");
        expect(status).toBeEmptyDOMElement();

        await fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
        expect(status).toHaveTextContent(en.account.deleting);

        resolve({ ok: true });
        await waitFor(() => expect(status.textContent).toBe(""));
      });

      it("shows the failure, then can be dismissed and reopened without a stale error", async () => {
        await startDelete();

        reject(new ApiError(500, "Server down"));
        expect(await within(screen.getByRole("alertdialog")).findByRole("alert")).toHaveTextContent("Server down");
        expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();

        await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(dialog()).not.toBeInTheDocument();
        await openDialog();

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      });
    });

    it("disables Confirm while the request is in flight, so it is sent once", async () => {
      let resolve!: (value: unknown) => void;
      mockedDeleteAccount.mockReturnValue(new Promise((res) => (resolve = res)));
      renderWithI18n(() => <AccountSettings />);
      await openDialog();

      await fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
      expect(screen.getByRole("button", { name: "Confirm delete" })).toBeDisabled();
      await fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

      expect(mockedDeleteAccount).toHaveBeenCalledTimes(1);

      resolve({ ok: true });
      await waitFor(() => expect(mockedSetCurrentUser).toHaveBeenCalledWith(null));
    });
  });

  describe("failures", () => {
    const confirmDelete = async () => {
      await fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
      await fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    };

    it("shows the server's message when logout fails with an ApiError", async () => {
      mockedLogout.mockRejectedValue(new ApiError(500, "Server down"));
      renderWithI18n(() => <AccountSettings />);

      await fireEvent.click(screen.getByRole("button", { name: "Log out" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Server down");
      expect(mockedSetCurrentUser).not.toHaveBeenCalled();
    });

    it("shows a generic message when logout fails with another error", async () => {
      mockedLogout.mockRejectedValue(new Error("boom"));
      renderWithI18n(() => <AccountSettings />);

      await fireEvent.click(screen.getByRole("button", { name: "Log out" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(en.account.logoutError);
      expect(mockedSetCurrentUser).not.toHaveBeenCalled();
    });

    it("shows the server's message when deleting the account fails with an ApiError", async () => {
      mockedDeleteAccount.mockRejectedValue(new ApiError(500, "Server down"));
      renderWithI18n(() => <AccountSettings />);

      await confirmDelete();

      expect(await screen.findByRole("alert")).toHaveTextContent("Server down");
      expect(mockedSetCurrentUser).not.toHaveBeenCalled();
    });

    it("shows a generic message when deleting the account fails with another error", async () => {
      mockedDeleteAccount.mockRejectedValue(new Error("boom"));
      renderWithI18n(() => <AccountSettings />);

      await confirmDelete();

      expect(await screen.findByRole("alert")).toHaveTextContent(en.account.deleteError);
      expect(mockedSetCurrentUser).not.toHaveBeenCalled();
    });

    it("clears a shown error when the next attempt starts", async () => {
      mockedLogout.mockRejectedValueOnce(new ApiError(500, "Server down")).mockResolvedValueOnce({ ok: true });
      renderWithI18n(() => <AccountSettings />);

      await fireEvent.click(screen.getByRole("button", { name: "Log out" }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();

      await fireEvent.click(screen.getByRole("button", { name: "Log out" }));

      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
      expect(mockedSetCurrentUser).toHaveBeenCalledWith(null);
    });
  });
});
