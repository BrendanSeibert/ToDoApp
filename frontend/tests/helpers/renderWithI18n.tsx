import type { JSX } from "solid-js";
import { render } from "@solidjs/testing-library";
import { I18nProvider } from "~/context/I18nContext";

// Uses the real dictionary, so tests keep asserting the text users actually see.
export function renderWithI18n(ui: () => JSX.Element) {
  return render(() => <I18nProvider>{ui()}</I18nProvider>);
}
