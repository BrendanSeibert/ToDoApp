import { createEffect, onMount, Show } from "solid-js";
import "./App.scss";
import { getMe } from "~/api/auth";
import { useAuth } from "~/context/AuthContext";
import { useI18n } from "~/context/I18nContext";
import AuthForms from "./components/AuthForms";
import TodoApp from "./components/TodoApp";

export default function App() {
  const { user, setCurrentUser, initializing, finishInitializing } = useAuth();
  const { t } = useI18n();

  createEffect(() => {
    document.title = t("app.title");
  });

  onMount(async () => {
    try {
      setCurrentUser(await getMe());
    } catch {
      setCurrentUser(null);
    } finally {
      finishInitializing();
    }
  });

  return (
    <div class="d-app app">
      <Show when={!initializing()} fallback={<p>{t("app.loading")}</p>}>
        <Show when={user()} fallback={<AuthForms />}>
          <TodoApp />
        </Show>
      </Show>
    </div>
  );
}
