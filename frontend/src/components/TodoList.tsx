import { createSignal, For, Show } from "solid-js";
import { MdFillAdd_box } from "solid-icons/md";
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
  // create is in flight would duplicate it. Applied to each form control, so any control added
  // to the form needs `disabled={formDisabled()}` too.
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
        <label class="new-todo-field">
          <span class="visually-hidden">{t("todos.label")}</span>
          <input
            type="text"
            placeholder={t("todos.placeholder")}
            value={newTitle()}
            disabled={formDisabled()}
            onInput={(e) => setNewTitle(e.currentTarget.value)}
          />
        </label>
        <button
          type="submit"
          class="add-button"
          title={t("todos.add")}
          aria-label={t("todos.add")}
          disabled={formDisabled()}
        >
          <MdFillAdd_box size={21.33} aria-hidden="true" />
        </button>
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
