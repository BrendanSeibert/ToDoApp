import { onMount, Show } from "solid-js";
import "./App.scss";
import { getMe } from "~/api/auth";
import { useAuth } from "~/context/AuthContext";
import AuthForms from "./components/AuthForms";
import TodoApp from "./components/TodoApp";

export default function App() {
  const { user, setCurrentUser, initializing, finishInitializing } = useAuth();

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
    <Show when={!initializing()} fallback={<p>Loading…</p>}>
      <Show when={user()} fallback={<AuthForms />}>
        <TodoApp />
      </Show>
    </Show>
  );
}
