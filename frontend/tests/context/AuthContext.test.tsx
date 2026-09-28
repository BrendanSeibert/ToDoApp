import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { AuthProvider, useAuth } from "~/context/AuthContext";

function Consumer() {
  const { user, setCurrentUser, initializing, finishInitializing } = useAuth();

  return (
    <div>
      <p data-testid="user">{user()?.email ?? "none"}</p>
      <p data-testid="initializing">{String(initializing())}</p>
      <button
        type="button"
        onClick={() => setCurrentUser({ id: "u1", email: "a@example.com", createdAt: "now" })}
      >
        set user
      </button>
      <button type="button" onClick={() => setCurrentUser(null)}>
        clear user
      </button>
      <button type="button" onClick={() => finishInitializing()}>
        finish initializing
      </button>
    </div>
  );
}

describe("AuthContext", () => {
  it("throws when useAuth is called outside of an AuthProvider", () => {
    expect(() => render(() => <Consumer />)).toThrow("useAuth must be used within an AuthProvider");
  });

  it("starts with no user and initializing set to true", () => {
    render(() => (
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    ));

    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(screen.getByTestId("initializing")).toHaveTextContent("true");
  });

  it("updates the user via setCurrentUser", async () => {
    render(() => (
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    ));

    await fireEvent.click(screen.getByRole("button", { name: "set user" }));
    expect(screen.getByTestId("user")).toHaveTextContent("a@example.com");

    await fireEvent.click(screen.getByRole("button", { name: "clear user" }));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });

  it("flips initializing to false via finishInitializing", async () => {
    render(() => (
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    ));

    await fireEvent.click(screen.getByRole("button", { name: "finish initializing" }));
    expect(screen.getByTestId("initializing")).toHaveTextContent("false");
  });
});
