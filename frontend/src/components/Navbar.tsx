import AccountSettings from "./AccountSettings";
import "./Navbar.scss";

export default function Navbar() {
  return (
    <header class="d-navbar navbar todo-header">
      <h1>Todos</h1>
      <AccountSettings />
    </header>
  );
}
