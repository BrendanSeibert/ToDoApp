import { onMount, Show } from "solid-js";
import { getMe } from "~/api/auth";
import { finishInitializing, initializing, setCurrentUser, user } from "~/store/auth";
import AuthForms from "./components/AuthForms";
import TodoApp from "./components/TodoApp";

export default function App() {
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
        {(currentUser) => <TodoApp user={currentUser()} />}
      </Show>
    </Show>
  );
}
