import { render } from "solid-js/web";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { TodoProvider } from "./context/TodoContext";

const root = document.getElementById("root");

render(
  () => (
    <AuthProvider>
      <TodoProvider>
        <App />
      </TodoProvider>
    </AuthProvider>
  ),
  root!,
);
