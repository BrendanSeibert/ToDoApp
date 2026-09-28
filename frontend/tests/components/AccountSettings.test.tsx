import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";

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
    render(() => <AccountSettings />);
    expect(screen.getByText("a@example.com")).toBeInTheDocument();
  });

  it("logs out and clears the current user", async () => {
    mockedLogout.mockResolvedValue({ ok: true });
    render(() => <AccountSettings />);

    await fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(mockedLogout).toHaveBeenCalled();
    expect(mockedSetCurrentUser).toHaveBeenCalledWith(null);
  });

  it("requires confirmation before deleting the account", async () => {
    mockedDeleteAccount.mockResolvedValue({ ok: true });
    render(() => <AccountSettings />);

    await fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    expect(mockedDeleteAccount).not.toHaveBeenCalled();

    await fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(mockedDeleteAccount).toHaveBeenCalled();
    expect(mockedSetCurrentUser).toHaveBeenCalledWith(null);
  });

  it("cancels the delete confirmation without deleting", async () => {
    render(() => <AccountSettings />);

    await fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();
    expect(mockedDeleteAccount).not.toHaveBeenCalled();
  });
});
