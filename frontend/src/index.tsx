import { render } from "solid-js/web";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { I18nProvider } from "./context/I18nContext";
import { TodoProvider } from "./context/TodoContext";

const root = document.getElementById("root");

render(
  () => (
    <I18nProvider>
      <AuthProvider>
        <TodoProvider>
          <App />
        </TodoProvider>
      </AuthProvider>
    </I18nProvider>
  ),
  root!,
);
