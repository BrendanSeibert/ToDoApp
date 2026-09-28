import { createSignal, For, Show } from "solid-js";
import "./TodoList.scss";
import { useTodos } from "~/context/TodoContext";
import TodoItem from "./TodoItem";

export default function TodoList() {
  const { todos, loading, error, createTodo, toggleTodo, deleteTodo } = useTodos();
  const [newTitle, setNewTitle] = createSignal("");

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    const title = newTitle().trim();
    if (!title) return;

    const created = await createTodo(title);
    if (created) setNewTitle("");
  }

  async function handleToggle(id: string, completed: boolean) {
    await toggleTodo(id, completed);
  }

  async function handleDelete(id: string) {
    await deleteTodo(id);
  }

  return (
    <section class="d-todo-list todo-list">
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
