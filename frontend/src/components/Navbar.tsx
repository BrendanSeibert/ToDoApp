import { useI18n } from "~/context/I18nContext";
import AccountSettings from "./AccountSettings";
import "./Navbar.scss";

export default function Navbar() {
  const { t } = useI18n();

  return (
    <header class="d-navbar navbar todo-header">
      <h1>{t("navbar.todos")}</h1>
      <AccountSettings />
    </header>
  );
}
