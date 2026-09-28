import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";

vi.mock("~/api/auth", () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  deleteAccount: vi.fn(),
}));
vi.mock("~/api/todos", () => ({
  listTodos: vi.fn().mockResolvedValue([]),
  createTodo: vi.fn(),
  setCompleted: vi.fn(),
  deleteTodo: vi.fn(),
}));

import { getMe } from "~/api/auth";
import { AuthProvider } from "~/context/AuthContext";
import { I18nProvider, useI18n } from "~/context/I18nContext";
import { TodoProvider } from "~/context/TodoContext";
import App from "~/App";

const mockedGetMe = getMe as unknown as ReturnType<typeof vi.fn>;

function SwitchLanguage() {
  const { setDictionary } = useI18n();
  return (
    <button type="button" onClick={() => setDictionary({ app: { title: "Aufgabenliste" } })}>
      switch language
    </button>
  );
}

function renderApp() {
  return render(() => (
    <I18nProvider>
      <AuthProvider>
        <TodoProvider>
          <App />
          <SwitchLanguage />
        </TodoProvider>
      </AuthProvider>
    </I18nProvider>
  ));
}

beforeEach(() => {
  mockedGetMe.mockReset();
  mockedGetMe.mockRejectedValue(new Error("Unauthorized"));
  document.title = "";
});

describe("App document title", () => {
  it("sets the document title from the dictionary", () => {
    renderApp();

    expect(document.title).toBe("Todo List");
  });

  it("updates the document title when the dictionary changes", async () => {
    renderApp();

    await fireEvent.click(screen.getByRole("button", { name: "switch language" }));

    expect(document.title).toBe("Aufgabenliste");
  });
});
