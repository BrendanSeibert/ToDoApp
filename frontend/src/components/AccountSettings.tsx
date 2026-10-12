import { createSignal, Show } from "solid-js";
import "./AccountSettings.scss";
import { deleteAccount, logout } from "~/api/auth";
import { ApiError } from "~/api/client";
import { useAuth } from "~/context/AuthContext";
import { useI18n } from "~/context/I18nContext";

export default function AccountSettings() {
  const { user, setCurrentUser } = useAuth();
  const { t } = useI18n();
  const [error, setError] = createSignal<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = createSignal(false);

  async function handleLogout() {
    setError(null);
    try {
      await logout();
      setCurrentUser(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("account.logoutError"));
    }
  }

  async function handleDeleteAccount() {
    setError(null);
    try {
      await deleteAccount();
      setCurrentUser(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("account.deleteError"));
    }
  }

  return (
    <div class="d-account-settings account-settings">
      <Show when={user()}>{(currentUser) => <span class="account-email">{currentUser().email}</span>}</Show>
      <button type="button" onClick={handleLogout}>
        {t("account.logout")}
      </button>

      <Show
        when={confirmingDelete()}
        fallback={
          <button type="button" class="danger" onClick={() => setConfirmingDelete(true)}>
            {t("account.deleteAccount")}
          </button>
        }
      >
        <span>{t("account.deleteConfirmation")}</span>
        <button type="button" class="danger confirm" onClick={handleDeleteAccount}>
          {t("account.confirmDelete")}
        </button>
        <button type="button" onClick={() => setConfirmingDelete(false)}>
          {t("account.cancel")}
        </button>
      </Show>

      <Show when={error()}>
        <p role="alert" class="error">
          {error()}
        </p>
      </Show>
    </div>
  );
}
