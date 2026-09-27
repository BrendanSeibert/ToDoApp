import { createSignal, Show } from "solid-js";
import "./AuthForms.scss";
import { login, register } from "~/api/auth";
import { ApiError } from "~/api/client";
import { setCurrentUser } from "~/store/auth";

export default function AuthForms() {
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
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div class="d-auth-forms auth-forms">
      <h1>{mode() === "login" ? "Log in" : "Create an account"}</h1>

      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            required
            autocomplete="email"
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
        </label>

        <label>
          Password
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
          {mode() === "login" ? "Log in" : "Register"}
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
        {mode() === "login" ? "Need an account? Register" : "Already have an account? Log in"}
      </button>
    </div>
  );
}
