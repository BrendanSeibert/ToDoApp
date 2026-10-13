import { Show } from "solid-js";
import { MdFillCheck_box, MdFillCheck_box_outline_blank } from "solid-icons/md";
import { TiDelete } from "solid-icons/ti";
import type { Todo } from "~/api/todos";
import { useI18n } from "~/context/I18nContext";
import "./TodoItem.scss";

interface TodoItemProps {
  todo: Todo;
  /** True while the row is waiting for its server id; it cannot be toggled or deleted yet. */
  pending?: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

export default function TodoItem(props: TodoItemProps) {
  const { t } = useI18n();

  return (
    <li class="d-todo-item todo-item" classList={{ pending: props.pending }} aria-busy={props.pending}>
      <label>
        <input
          type="checkbox"
          class="checkbox-input"
          checked={props.todo.completed}
          disabled={props.pending}
          onChange={(e) => !props.pending && props.onToggle(props.todo.id, e.currentTarget.checked)}
        />
        <span class="checkbox-icon" aria-hidden="true">
          <Show when={props.todo.completed} fallback={<MdFillCheck_box_outline_blank size={21.33} />}>
            <MdFillCheck_box size={21.33} />
          </Show>
        </span>
        <span classList={{ completed: props.todo.completed }}>{props.todo.title}</span>
      </label>
      <button
        type="button"
        class="delete-button"
        disabled={props.pending}
        title={t("todoItem.delete")}
        aria-label={t("todoItem.deleteAria", { title: props.todo.title })}
        onClick={() => props.onDelete(props.todo.id)}
      >
        <TiDelete size={24} aria-hidden="true" />
      </button>
    </li>
  );
}
