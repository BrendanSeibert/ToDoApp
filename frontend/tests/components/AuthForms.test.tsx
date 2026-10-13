import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@solidjs/testing-library";
import en from "~/i18n/en.json";
import { renderWithI18n } from "../helpers/renderWithI18n";

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
    renderWithI18n(() => <AuthForms />);

    await fireEvent.input(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
    await fireEvent.input(screen.getByLabelText("Password"), { target: { value: "password123" } });
    await fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(mockedLogin).toHaveBeenCalledWith("a@example.com", "password123");
    expect(mockedSetCurrentUser).toHaveBeenCalledWith({ id: "u1", email: "a@example.com", createdAt: "now" });
  });

  it("switches to register mode and registers with the entered credentials", async () => {
    mockedRegister.mockResolvedValue({ id: "u2", email: "b@example.com", createdAt: "now" });
    renderWithI18n(() => <AuthForms />);

    await fireEvent.click(screen.getByText(/need an account/i));
    await fireEvent.input(screen.getByLabelText("Email"), { target: { value: "b@example.com" } });
    await fireEvent.input(screen.getByLabelText("Password"), { target: { value: "password123" } });
    await fireEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(mockedRegister).toHaveBeenCalledWith("b@example.com", "password123");
    expect(mockedSetCurrentUser).toHaveBeenCalledWith({ id: "u2", email: "b@example.com", createdAt: "now" });
  });

  it("shows an error message when login fails", async () => {
    mockedLogin.mockRejectedValue(new ApiError(401, "Invalid email or password"));
    renderWithI18n(() => <AuthForms />);

    await fireEvent.input(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
    await fireEvent.input(screen.getByLabelText("Password"), { target: { value: "wrongpassword" } });
    await fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(mockedSetCurrentUser).not.toHaveBeenCalled();
  });

  it("shows a generic message when login fails with a non-API error", async () => {
    mockedLogin.mockRejectedValue(new Error("boom"));
    renderWithI18n(() => <AuthForms />);

    await fireEvent.input(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
    await fireEvent.input(screen.getByLabelText("Password"), { target: { value: "password123" } });
    await fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(en.auth.genericError);
  });

  it("shows the server's message when registration fails", async () => {
    mockedRegister.mockRejectedValue(new ApiError(400, "An account with this email already exists"));
    renderWithI18n(() => <AuthForms />);

    await fireEvent.click(screen.getByText(/need an account/i));
    await fireEvent.input(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
    await fireEvent.input(screen.getByLabelText("Password"), { target: { value: "password123" } });
    await fireEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("An account with this email already exists");
    expect(mockedSetCurrentUser).not.toHaveBeenCalled();
  });

  it("disables the submit button while a request is in flight and clears the previous error", async () => {
    mockedLogin.mockRejectedValueOnce(new ApiError(401, "Invalid email or password"));
    let resolve!: (user: unknown) => void;
    mockedLogin.mockReturnValueOnce(new Promise((res) => (resolve = res)));
    renderWithI18n(() => <AuthForms />);
    await fireEvent.input(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
    await fireEvent.input(screen.getByLabelText("Password"), { target: { value: "password123" } });
    await fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByRole("alert");

    await fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(screen.getByRole("button", { name: "Log in" })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    resolve({ id: "u1", email: "a@example.com", createdAt: "now" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled());
  });

  it("switches back to login mode and clears the error on each switch", async () => {
    mockedLogin.mockRejectedValue(new ApiError(401, "Invalid email or password"));
    renderWithI18n(() => <AuthForms />);
    await fireEvent.input(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
    await fireEvent.input(screen.getByLabelText("Password"), { target: { value: "password123" } });
    await fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByRole("alert");

    await fireEvent.click(screen.getByText(/need an account/i));
    expect(screen.getByRole("heading", { name: en.auth.register.heading })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await fireEvent.click(screen.getByText(/already have an account/i));
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });
});
