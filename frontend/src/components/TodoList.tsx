import { createSignal, For, Show } from "solid-js";
import "./TodoList.scss";
import { useI18n } from "~/context/I18nContext";
import { useTodos } from "~/context/TodoContext";
import TodoItem from "./TodoItem";

export default function TodoList() {
  const { todos, loading, error, createTodo, toggleTodo, deleteTodo } = useTodos();
  const { t } = useI18n();
  const [newTitle, setNewTitle] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  // Adding during the initial fetch would be overwritten when it lands; adding while a
  // create is in flight would duplicate it.
  const formDisabled = () => loading() || submitting();

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    if (formDisabled()) return;
    const title = newTitle().trim();
    if (!title) return;

    setSubmitting(true);
    try {
      const created = await createTodo(title);
      if (created) setNewTitle("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(id: string, completed: boolean) {
    await toggleTodo(id, completed);
  }

  async function handleDelete(id: string) {
    await deleteTodo(id);
  }

  return (
    <section class="d-todo-list todo-list">
      <form onSubmit={handleCreate} aria-busy={formDisabled()}>
        <fieldset disabled={formDisabled()}>
          <input
            type="text"
            placeholder={t("todos.placeholder")}
            value={newTitle()}
            onInput={(e) => setNewTitle(e.currentTarget.value)}
          />
          <button type="submit">{t("todos.add")}</button>
        </fieldset>
      </form>

      <Show when={error()}>
        <p role="alert" class="error">
          {error()}
        </p>
      </Show>

      <Show when={!loading()} fallback={<p>{t("todos.loading")}</p>}>
        <Show when={todos().length > 0} fallback={<p>{t("todos.empty")}</p>}>
          <ul>
            <For each={todos()}>{(todo) => <TodoItem todo={todo} onToggle={handleToggle} onDelete={handleDelete} />}</For>
          </ul>
        </Show>
      </Show>
    </section>
  );
}
