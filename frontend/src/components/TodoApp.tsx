import type { User } from "~/api/auth";
import Navbar from "./Navbar";
import TodoList from "./TodoList";
import "./TodoApp.scss";

interface TodoAppProps {
  user: User;
}

export default function TodoApp(props: TodoAppProps) {
  return (
    <div class="d-todo-app todo-app">
      <Navbar user={props.user} />
      <TodoList />
    </div>
  );
}
