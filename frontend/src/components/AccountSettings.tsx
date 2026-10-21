import { createSignal, createUniqueId, Show } from "solid-js";
import "./AccountSettings.scss";
import { deleteAccount, logout } from "~/api/auth";
import { ApiError } from "~/api/client";
import { useAuth } from "~/context/AuthContext";
import { useI18n } from "~/context/I18nContext";
import Popover from "./Popover";

export default function AccountSettings() {
  const { user, setCurrentUser } = useAuth();
  const { t } = useI18n();
  const [error, setError] = createSignal<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);
  const descriptionId = createUniqueId();
  let cancelButton: HTMLButtonElement | undefined;

  async function handleLogout() {
    setError(null);
    try {
      await logout();
      setCurrentUser(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("account.logoutError"));
    }
  }

  function closeDeleteDialog() {
    // A request in flight can still succeed or fail; keep the dialog up to show which.
    if (deleting()) return;
    setConfirmingDelete(false);
    setDeleteError(null);
  }

  async function handleDeleteAccount() {
    if (deleting()) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      setCurrentUser(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : t("account.deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div class="d-account-settings account-settings">
      <Show when={user()}>{(currentUser) => <span class="account-email">{currentUser().email}</span>}</Show>
      <button type="button" onClick={handleLogout}>
        {t("account.logout")}
      </button>
      <button type="button" class="danger" aria-haspopup="dialog" onClick={() => setConfirmingDelete(true)}>
        {t("account.deleteAccount")}
      </button>

      <Show when={error()}>
        <p role="alert" class="error">
          {error()}
        </p>
      </Show>

      <Popover
        open={confirmingDelete()}
        onClose={closeDeleteDialog}
        title={t("account.deleteTitle")}
        role="alertdialog"
        describedBy={descriptionId}
        dismissible={!deleting()}
        initialFocus={() => cancelButton}
      >
        <div class="d-account-delete-dialog account-delete-dialog">
          <p id={descriptionId}>{t("account.deleteConfirmation")}</p>

          <p role="status" class="visually-hidden">
            {deleting() ? t("account.deleting") : ""}
          </p>

          <Show when={deleteError()}>
            <p role="alert" class="error">
              {deleteError()}
            </p>
          </Show>

          <div class="actions">
            <button type="button" ref={cancelButton} disabled={deleting()} onClick={closeDeleteDialog}>
              {t("account.cancel")}
            </button>
            <button type="button" class="confirm" disabled={deleting()} onClick={handleDeleteAccount}>
              {t("account.confirmDelete")}
            </button>
          </div>
        </div>
      </Popover>
    </div>
  );
}
