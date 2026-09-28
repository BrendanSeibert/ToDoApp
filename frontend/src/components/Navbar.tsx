import { useI18n } from "~/context/I18nContext";
import AccountSettings from "./AccountSettings";
import "./Navbar.scss";

export default function Navbar() {
  const { t } = useI18n();

  return (
    <header class="d-navbar navbar todo-header">
      <div class="nav-group-left">
        <h1>{t("navbar.todos")}</h1>
      </div>
      <div class="nav-group-right">
        <AccountSettings />
      </div>
    </header>
  );
}
