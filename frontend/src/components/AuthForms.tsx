import { createSignal, Show } from "solid-js";
import "./AuthForms.scss";
import { login, register } from "~/api/auth";
import { ApiError } from "~/api/client";
import { useAuth } from "~/context/AuthContext";
import { useI18n } from "~/context/I18nContext";

export default function AuthForms() {
  const { setCurrentUser } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = createSignal<"login" | "register">("login");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const user = mode() === "login" ? await login(email(), password()) : await register(email(), password());
      setCurrentUser(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div class="d-auth-forms auth-forms">
      <h1>{mode() === "login" ? t("auth.login.heading") : t("auth.register.heading")}</h1>

      <form onSubmit={handleSubmit}>
        <label>
          {t("auth.email")}
          <input
            type="email"
            required
            autocomplete="email"
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
        </label>

        <label>
          {t("auth.password")}
          <input
            type="password"
            required
            minLength={8}
            autocomplete={mode() === "login" ? "current-password" : "new-password"}
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
        </label>

        <Show when={error()}>
          <p role="alert" class="error">
            {error()}
          </p>
        </Show>

        <button type="submit" disabled={submitting()}>
          {mode() === "login" ? t("auth.login.submit") : t("auth.register.submit")}
        </button>
      </form>

      <button
        type="button"
        class="link-button"
        onClick={() => {
          setError(null);
          setMode(mode() === "login" ? "register" : "login");
        }}
      >
        {mode() === "login" ? t("auth.login.switchToRegister") : t("auth.register.switchToLogin")}
      </button>
    </div>
  );
}
