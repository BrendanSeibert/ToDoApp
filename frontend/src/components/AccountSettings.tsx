import { createSignal, Show } from "solid-js";
import "./AccountSettings.scss";
import { deleteAccount, logout, type User } from "~/api/auth";
import { ApiError } from "~/api/client";
import { setCurrentUser } from "~/store/auth";

interface AccountSettingsProps {
  user: User;
}

export default function AccountSettings(props: AccountSettingsProps) {
  const [error, setError] = createSignal<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = createSignal(false);

  async function handleLogout() {
    setError(null);
    try {
      await logout();
      setCurrentUser(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to log out.");
    }
  }

  async function handleDeleteAccount() {
    setError(null);
    try {
      await deleteAccount();
      setCurrentUser(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete account.");
    }
  }

  return (
    <div class="d-account-settings account-settings">
      <span>{props.user.email}</span>
      <button type="button" onClick={handleLogout}>
        Log out
      </button>

      <Show
        when={confirmingDelete()}
        fallback={
          <button type="button" class="danger" onClick={() => setConfirmingDelete(true)}>
            Delete account
          </button>
        }
      >
        <span>Are you sure? This deletes your account and all todos.</span>
        <button type="button" class="danger" onClick={handleDeleteAccount}>
          Confirm delete
        </button>
        <button type="button" onClick={() => setConfirmingDelete(false)}>
          Cancel
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
