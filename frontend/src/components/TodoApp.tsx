import type { User } from "~/api/auth";
import AccountSettings from "./AccountSettings";
import TodoList from "./TodoList";

interface TodoAppProps {
  user: User;
}

export default function TodoApp(props: TodoAppProps) {
  return (
    <div class="todo-app">
      <header>
        <h1>Todos</h1>
        <AccountSettings user={props.user} />
      </header>
      <TodoList />
    </div>
  );
}
