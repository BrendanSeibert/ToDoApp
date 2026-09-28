import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";

vi.mock("~/api/auth", () => ({
  login: vi.fn(),
  register: vi.fn(),
}));

const mockedSetCurrentUser = vi.fn();
vi.mock("~/context/AuthContext", () => ({
  useAuth: () => ({ setCurrentUser: mockedSetCurrentUser }),
}));

import { login, register } from "~/api/auth";
import { ApiError } from "~/api/client";
import AuthForms from "~/components/AuthForms";

const mockedLogin = login as unknown as ReturnType<typeof vi.fn>;
const mockedRegister = register as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedLogin.mockReset();
  mockedRegister.mockReset();
  mockedSetCurrentUser.mockReset();
});

describe("AuthForms", () => {
  it("defaults to login mode and logs in with the entered credentials", async () => {
    mockedLogin.mockResolvedValue({ id: "u1", email: "a@example.com", createdAt: "now" });
    render(() => <AuthForms />);

    await fireEvent.input(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
    await fireEvent.input(screen.getByLabelText("Password"), { target: { value: "password123" } });
    await fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(mockedLogin).toHaveBeenCalledWith("a@example.com", "password123");
    expect(mockedSetCurrentUser).toHaveBeenCalledWith({ id: "u1", email: "a@example.com", createdAt: "now" });
  });

  it("switches to register mode and registers with the entered credentials", async () => {
    mockedRegister.mockResolvedValue({ id: "u2", email: "b@example.com", createdAt: "now" });
    render(() => <AuthForms />);

    await fireEvent.click(screen.getByText(/need an account/i));
    await fireEvent.input(screen.getByLabelText("Email"), { target: { value: "b@example.com" } });
    await fireEvent.input(screen.getByLabelText("Password"), { target: { value: "password123" } });
    await fireEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(mockedRegister).toHaveBeenCalledWith("b@example.com", "password123");
    expect(mockedSetCurrentUser).toHaveBeenCalledWith({ id: "u2", email: "b@example.com", createdAt: "now" });
  });

  it("shows an error message when login fails", async () => {
    mockedLogin.mockRejectedValue(new ApiError(401, "Invalid email or password"));
    render(() => <AuthForms />);

    await fireEvent.input(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
    await fireEvent.input(screen.getByLabelText("Password"), { target: { value: "wrongpassword" } });
    await fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(mockedSetCurrentUser).not.toHaveBeenCalled();
  });
});
