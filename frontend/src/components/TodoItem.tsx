import { TiDelete } from "solid-icons/ti";
import type { Todo } from "~/api/todos";
import { useI18n } from "~/context/I18nContext";
import "./TodoItem.scss";

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

export default function TodoItem(props: TodoItemProps) {
  const { t } = useI18n();

  return (
    <li class="d-todo-item todo-item">
      <label>
        <input
          type="checkbox"
          checked={props.todo.completed}
          onChange={(e) => props.onToggle(props.todo.id, e.currentTarget.checked)}
        />
        <span classList={{ completed: props.todo.completed }}>{props.todo.title}</span>
      </label>
      <button
        type="button"
        class="delete-button"
        title={t("todoItem.delete")}
        aria-label={t("todoItem.deleteAria", { title: props.todo.title })}
        onClick={() => props.onDelete(props.todo.id)}
      >
        <TiDelete size={24} aria-hidden="true" />
      </button>
    </li>
  );
}
