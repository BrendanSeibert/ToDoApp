import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { I18nProvider, useI18n } from "~/context/I18nContext";

function Consumer() {
  const { t, setDictionary } = useI18n();

  return (
    <div>
      <p data-testid="plain">{t("navbar.todos")}</p>
      <p data-testid="interpolated">{t("todoItem.deleteAria", { title: "Buy milk" })}</p>
      <button type="button" onClick={() => setDictionary({ navbar: { todos: "Aufgaben" } })}>
        switch
      </button>
    </div>
  );
}

describe("I18nContext", () => {
  it("throws when useI18n is called outside of an I18nProvider", () => {
    expect(() => render(() => <Consumer />)).toThrow("useI18n must be used within an I18nProvider");
  });

  it("returns strings from the bundled English dictionary by default", () => {
    render(() => (
      <I18nProvider>
        <Consumer />
      </I18nProvider>
    ));

    expect(screen.getByTestId("plain")).toHaveTextContent("To-Dos");
    expect(screen.getByTestId("interpolated")).toHaveTextContent("Delete Buy milk");
  });

  it("uses a dictionary passed to the provider", () => {
    render(() => (
      <I18nProvider dictionary={{ navbar: { todos: "Tareas" } }}>
        <Consumer />
      </I18nProvider>
    ));

    expect(screen.getByTestId("plain")).toHaveTextContent("Tareas");
  });

  it("re-renders translated text when the dictionary changes", async () => {
    render(() => (
      <I18nProvider>
        <Consumer />
      </I18nProvider>
    ));

    await fireEvent.click(screen.getByRole("button", { name: "switch" }));

    expect(screen.getByTestId("plain")).toHaveTextContent("Aufgaben");
  });
});
