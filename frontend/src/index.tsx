import { render } from "solid-js/web";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";

const root = document.getElementById("root");

render(
  () => (
    <AuthProvider>
      <App />
    </AuthProvider>
  ),
  root!,
);
