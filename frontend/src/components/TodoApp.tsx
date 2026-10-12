import Navbar from "./Navbar";
import TodoList from "./TodoList";
import "./TodoApp.scss";

export default function TodoApp() {
  return (
    <div class="d-todo-app todo-app">
      <Navbar />
      <main>
        <TodoList />
      </main>
    </div>
  );
}
