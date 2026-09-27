import type { Todo } from "~/api/todos";
import "./TodoItem.scss";

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

export default function TodoItem(props: TodoItemProps) {
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
      <button type="button" aria-label={`Delete ${props.todo.title}`} onClick={() => props.onDelete(props.todo.id)}>
        Delete
      </button>
    </li>
  );
}
