import type { User } from "~/api/auth";
import AccountSettings from "./AccountSettings";
import TodoList from "./TodoList";
import "./TodoApp.scss";

interface TodoAppProps {
  user: User;
}

export default function TodoApp(props: TodoAppProps) {
  return (
    <div class="d-todo-app todo-app">
      <header>
        <h1>Todos</h1>
        <AccountSettings user={props.user} />
      </header>
      <TodoList />
    </div>
  );
}
