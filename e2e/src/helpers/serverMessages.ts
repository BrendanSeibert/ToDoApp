// Texts produced by the backend, not by en.json. Keep in sync with backend/src/routes/api/auth.
export const serverMessages = {
  emailTaken: "An account with this email already exists",
  badCredentials: "Invalid email or password",
  // The backend requires a dot in the domain; Chrome's type="email" does not (e.g. "user@localhost").
  invalidEmail: "A valid email is required",
  // Normally Chrome's minLength blocks a short password first, but the app's controlled input
  // (value={password()}) clears Chrome's "user edited" flag, so the request reaches the server.
  passwordTooShort: "Password must be at least 8 characters",
};
