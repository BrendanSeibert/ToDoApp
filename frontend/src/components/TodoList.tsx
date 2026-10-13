import { createSignal, For, onCleanup, Show } from "solid-js";
import { MdFillAdd_box } from "solid-icons/md";
import "./TodoList.scss";
import { useI18n } from "~/context/I18nContext";
import { useTodos } from "~/context/TodoContext";
import TodoItem from "./TodoItem";

const TITLE_ERROR_TIMEOUT_MS = 15_000;

export default function TodoList() {
  const { todos, loading, error, isPending, createTodo, toggleTodo, deleteTodo } = useTodos();
  const { t } = useI18n();
  const [newTitle, setNewTitle] = createSignal("");
  const [pendingCreates, setPendingCreates] = createSignal(0);
  // Adding during the initial fetch would be overwritten when it lands, so the form is disabled
  // until the list has loaded. Creates intentionally do not lock it: rows are added optimistically.
  // Applied to each form control, so any control added to the form needs
  // `disabled={formDisabled()}` too.
  const formDisabled = () => loading();
  const [showTitleError, setShowTitleError] = createSignal(false);
  let titleErrorTimer: ReturnType<typeof setTimeout> | undefined;

  function hideTitleRequired() {
    clearTimeout(titleErrorTimer);
    titleErrorTimer = undefined;
    setShowTitleError(false);
  }

  // Restarts the countdown if the message is already showing, so timers never stack.
  function showTitleRequired() {
    clearTimeout(titleErrorTimer);
    setShowTitleError(true);
    titleErrorTimer = setTimeout(hideTitleRequired, TITLE_ERROR_TIMEOUT_MS);
  }

  onCleanup(() => clearTimeout(titleErrorTimer));

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    if (formDisabled()) return;
    const title = newTitle().trim();
    if (!title) {
      // The first click of a double click has already cleared the input; do not nag.
      if (pendingCreates() === 0) showTitleRequired();
      return;
    }

    hideTitleRequired();
    setNewTitle("");
    setPendingCreates((count) => count + 1);
    try {
      const created = await createTodo(title);
      // Put the text back only if the user has not started typing something else.
      if (!created && newTitle() === "") setNewTitle(title);
    } finally {
      setPendingCreates((count) => count - 1);
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
            aria-invalid={showTitleError()}
            aria-describedby={showTitleError() ? "new-todo-error" : undefined}
            onInput={(e) => {
              setNewTitle(e.currentTarget.value);
              hideTitleRequired();
            }}
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

      <Show when={showTitleError()}>
        <p role="alert" class="error" id="new-todo-error">
          {t("todos.titleRequired")}
        </p>
      </Show>

      <Show when={error()}>
        <p role="alert" class="error">
          {error()}
        </p>
      </Show>

      <Show when={!loading()} fallback={<p>{t("todos.loading")}</p>}>
        <Show when={todos().length > 0} fallback={<p>{t("todos.empty")}</p>}>
          <ul>
            <For each={todos()}>
              {(todo) => (
                <TodoItem
                  todo={todo}
                  pending={isPending(todo.id)}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              )}
            </For>
          </ul>
        </Show>
      </Show>
    </section>
  );
}
