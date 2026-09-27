import type { User } from "~/api/auth";
import AccountSettings from "./AccountSettings";
import "./Navbar.scss";

interface NavbarProps {
  user: User;
}

export default function Navbar(props: NavbarProps) {
  return (
    <header class="d-navbar navbar todo-header">
      <h1>Todos</h1>
      <AccountSettings user={props.user} />
    </header>
  );
}
