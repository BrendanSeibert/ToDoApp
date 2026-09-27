import { createSignal, For, onMount, Show } from "solid-js";
import { createTodo, deleteTodo, listTodos, setCompleted, type Todo } from "~/api/todos";
import { ApiError } from "~/api/client";
import TodoItem from "./TodoItem";

export default function TodoList() {
  const [todos, setTodos] = createSignal<Todo[]>([]);
  const [newTitle, setNewTitle] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  async function refresh() {
    try {
      setTodos(await listTodos());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load todos.");
    } finally {
      setLoading(false);
    }
  }

  onMount(refresh);

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    const title = newTitle().trim();
    if (!title) return;

    try {
      const todo = await createTodo(title);
      setTodos([...todos(), todo]);
      setNewTitle("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create todo.");
    }
  }

  async function handleToggle(id: string, completed: boolean) {
    try {
      const updated = await setCompleted(id, completed);
      setTodos(todos().map((todo) => (todo.id === id ? updated : todo)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update todo.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTodo(id);
      setTodos(todos().filter((todo) => todo.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete todo.");
    }
  }

  return (
    <section class="todo-list">
      <form onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="What needs doing?"
          value={newTitle()}
          onInput={(e) => setNewTitle(e.currentTarget.value)}
        />
        <button type="submit">Add</button>
      </form>

      <Show when={error()}>
        <p role="alert" class="error">
          {error()}
        </p>
      </Show>

      <Show when={!loading()} fallback={<p>Loading todos…</p>}>
        <Show when={todos().length > 0} fallback={<p>No todos yet.</p>}>
          <ul>
            <For each={todos()}>{(todo) => <TodoItem todo={todo} onToggle={handleToggle} onDelete={handleDelete} />}</For>
          </ul>
        </Show>
      </Show>
    </section>
  );
}
