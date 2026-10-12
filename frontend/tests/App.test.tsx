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
    <button type="button" onClick={() => setDictionary({ app: { title: "Aufgabenliste", lang: "de" } })}>
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

describe("App landmarks", () => {
  it("has a main landmark while loading", () => {
    mockedGetMe.mockReturnValue(new Promise(() => {}));
    renderApp();

    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("has a single main landmark on the login screen", async () => {
    renderApp();

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("has a banner and a single main landmark when signed in", async () => {
    mockedGetMe.mockResolvedValue({ id: "u1", email: "a@example.com", createdAt: "now" });
    renderApp();

    expect(await screen.findByRole("banner")).toBeInTheDocument();
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });
});

describe("App document language", () => {
  beforeEach(() => {
    document.documentElement.lang = "";
  });

  it("sets the html lang attribute from the dictionary", () => {
    renderApp();

    expect(document.documentElement.lang).toBe("en");
  });

  it("updates the html lang attribute when the dictionary changes", async () => {
    renderApp();

    await fireEvent.click(screen.getByRole("button", { name: "switch language" }));

    expect(document.documentElement.lang).toBe("de");
  });

  it("leaves the attribute alone when the dictionary has no language", () => {
    document.documentElement.lang = "fr";
    render(() => (
      <I18nProvider dictionary={{ app: { title: "Liste" } }}>
        <AuthProvider>
          <TodoProvider>
            <App />
          </TodoProvider>
        </AuthProvider>
      </I18nProvider>
    ));

    expect(document.documentElement.lang).toBe("fr");
  });
});
