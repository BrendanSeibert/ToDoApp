# Selenium End-to-End Testing Plan

Add an automated browser test suite (Selenium WebDriver) that drives the real app through a real browser and confirms its current behaviour: registering, logging in and out, adding / toggling / deleting to-dos, the empty-input error, and deleting an account.

This document is written so that a developer who has never seen this repo, or another Claude instance, can implement it step by step. Every step says **what to do, where, and how to know it worked.** If a step says "expected result", do not move on until you have seen it.

---

## 0. Contents

1. Goal and non-goals
2. Words you need to know
3. Facts about this app the tests depend on
4. Target layout
5. Implementation steps (Steps 1 to 14, plus Step 15 for when optimistic add/delete lands)
6. Scenario reference (what each test must assert)
7. Troubleshooting
8. Acceptance criteria
9. Conventions for this repo
10. Open decisions and follow-ups

---

## 1. Goal and non-goals

**Goal:** a repeatable `npm` command that starts a throwaway copy of the whole app (database, backend, frontend) in Docker, opens it in headless Chrome, runs user-level scenarios, reports pass/fail, and tears everything down.

**Non-goals (for this first version):**

- No cross-browser matrix (Chrome only).
- No visual-regression or performance testing.
- No changes to application code, unless a step explicitly says so. (The only such cases are the temporary deliberate break in Step 11 and the optional `data-testid` hooks in sections 9 and 10.)
- Not part of the default `npm test` in `frontend/` or `backend/` (it needs Docker and Chrome and takes minutes).

## 2. Words you need to know

| Term | Meaning |
|---|---|
| **End-to-end (e2e) test** | A test that uses the app the way a person does (click, type, read the screen) with every real layer running. |
| **Selenium WebDriver** | A library that remote-controls a real browser from code. |
| **ChromeDriver** | The small program that lets Selenium talk to Chrome. Selenium downloads the right version automatically ("Selenium Manager"), as long as Chrome is installed. |
| **Headless** | Chrome running with no visible window. Faster; used by default. |
| **Page Object** | A small class that hides selectors for one screen (`AuthPage`, `TodoPage`), so tests read like "log in as X", not "find element `.auth-forms input[type=email]`". |
| **Explicit wait** | "Wait until this condition is true, up to N seconds." Always use these. Never use fixed sleeps. |
| **Origin** | Scheme + host + **port**, e.g. `http://localhost:5273`. CORS compares origins. |
| **Site** | Roughly the host name, **ignoring the port**. `localhost:5273` and `localhost:3101` are the same site. Cookies compare sites. |

## 3. Facts about this app the tests depend on

Read this section carefully; several are easy to trip over.

### 3.1 How the app is deployed in Docker

- **Database:** Neo4j 5.
- **Backend:** SolidStart API, listens on port 3000 inside its container. Built with `backend/Dockerfile`, target `runtime`, which runs with `NODE_ENV=production`.
- **Frontend:** a built SolidJS bundle served by nginx on port 80 inside its container (`frontend/Dockerfile`, target `runtime`).
- **`VITE_API_URL` is baked in at build time.** It is a Docker build argument. The URL the browser uses to call the API is fixed when the frontend image is built. Changing it requires `--build`.
- **`FRONTEND_ORIGIN`** (backend env var) is the single origin allowed by CORS. It must equal the address in the browser's address bar exactly, including the port.

### 3.2 The cookie rules (the thing most likely to confuse you)

- The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` when `NODE_ENV=production` (see `backend/src/lib/session.ts`). The Docker backend is production mode, so the cookie is `Secure`.
- `SameSite=Lax` means the browser only sends/accepts the cookie when the page and the API are on the **same site**. `localhost` for both is fine. Two different Docker service names (`frontend` vs `backend`) are **different sites** and login would silently fail.
- `Secure` normally needs HTTPS. Chrome makes an exception for `http://localhost`. **Always use the host name `localhost` in test URLs.** Do not use `frontend`, `backend`, or a custom host name.
- Consequence: the browser must run **on the host machine** (or somewhere that can use `localhost` for both), and the Docker stack must **publish ports** to the host. This plan does exactly that.

Symptom of getting this wrong: you log in, the app flashes the to-do screen, then returns to the login screen.

**Cookies ignore ports, so two stacks share one cookie jar.** The dev stack (`localhost:3001`) and the e2e stack (`localhost:3101`) set a cookie with the same name on the host `localhost`. In one ordinary Chrome profile, logging in to one logs you out of the other. The automated runs are unaffected (Selenium starts a fresh temporary profile), but when you check things **by hand** (Step 2, Step 14 row 5) use a private/incognito window or a separate Chrome profile for each stack.

### 3.3 Visible text

All UI text comes from `frontend/src/i18n/en.json`. Tests **import that file** instead of hard-coding English, so a wording change does not break every test. The strings tests care about:

| Purpose | Key | Current text |
|---|---|---|
| Login heading and submit | `auth.login.heading`, `auth.login.submit` | Log in |
| Switch to register link | `auth.login.switchToRegister` | Need an account? Register |
| Register heading | `auth.register.heading` | Create an account |
| Register submit | `auth.register.submit` | Register |
| Switch to login link | `auth.register.switchToLogin` | Already have an account? Log in |
| Log out button | `account.logout` | Log out |
| Delete account button | `account.deleteAccount` | Delete account |
| Delete confirmation text | `account.deleteConfirmation` | Are you sure? This deletes your account and all to-dos. |
| Confirm / cancel | `account.confirmDelete`, `account.cancel` | Confirm delete / Cancel |
| Navbar title | `navbar.todos` | To-Dos |
| New-to-do input label / placeholder | `todos.label`, `todos.placeholder` | New to-do / What needs doing? |
| Add button name | `todos.add` | Add |
| Empty-input error | `todos.titleRequired` | Enter a to-do item |
| Empty list | `todos.empty` | No to-dos yet. |
| Loading list | `todos.loading` | Loading to-dos… |
| Delete button name | `todoItem.deleteAria` | Delete {title} |
| Page title | `app.title` | To-Do List |

### 3.4 Messages that come from the server (not in en.json)

| Situation | Message shown |
|---|---|
| Registering an email that exists | An account with this email already exists |
| Wrong password or unknown email on login | Invalid email or password |
| Registering an email without a dot in the domain (e.g. `user@localhost`; Chrome accepts it, the server's regex does not) | A valid email is required |
| Registering with a password shorter than 8 characters | Password must be at least 8 characters |

Put these in one constants file in the e2e package (Step 7).

The last row is reachable through the UI. The password input has `minLength=8`, but Chrome's check does not fire for this app (see section 3.5 item 3), so the request reaches the server and this message is shown.

### 3.5 Behaviours that affect how tests are written

1. **Emails are lower-cased by the backend.** Generate lower-case emails in tests, otherwise the email shown on screen will not match what you typed. (The one deliberate exception is the case-insensitivity scenario in section 6, which types mixed case on purpose.)
2. **Passwords must be at least 8 characters.**
3. **The browser's `type="email"` check runs before the server, but its `minLength` check does not.** The email field is `type="email" required` and the password field has `minLength=8`. Measured against the real app: a short password typed with Selenium **does reach the server**, which answers "Password must be at least 8 characters" (shown in the alert). The probable cause is that the input is controlled (`value={password()}`), so the framework re-assigns `input.value` on every keystroke, and Chrome only reports "too short" for a value whose last change was a user edit. A real user typing is most likely affected in the same way, so the `minLength` attribute is effectively inert today.

   Write the test against the outcome that holds in both cases: the user stays on the register screen without an account, and *either* Chrome blocked the submit (`formIsInvalid()` is true) *or* the alert shows `serverMessages.passwordTooShort`. Do not assert only one of them: if the app is later fixed so the browser blocks the submit, a test pinned to the server message would fail for a good reason.
4. **The real checkbox is visually hidden** (1px, transparent). Selenium cannot click it. Click the visible icon (`.checkbox-icon`) or the label instead, and read the state from the hidden input's `isSelected()`.
5. **The "Enter a to-do item" message disappears** after 15 seconds, or as soon as the user types. The 15-second case is slow; make it skippable and give it its own timeout (Step 10). The same timer is better covered with fake timers in the frontend unit tests; keep the e2e version only as a real-browser sanity check.
6. **Deleting an account logs you out** and returns to the login screen. Logging in again with those credentials must fail with "Invalid email or password".
7. **Add and delete currently wait for the server** before the list updates. If the "optimistic add/delete" change (see `OptimisticAddDeletePlan.md`) is implemented, rows appear immediately and the suite as written in Steps 1 to 14 is **not** enough on its own:
   - A new row is *pending*: its checkbox and delete button are `disabled` until the server replies. Selenium's click on a disabled control does nothing and raises no error, so `toggle()` and `delete()` would wait out their full timeout, or pass or fail depending on a race. See item 13 and Step 15.
   - `waitForTitle` returns at once, because the row is already there. It no longer proves the server accepted anything.
   - None of the existing tests can tell optimistic from non-optimistic behaviour, and none cover rollback. New scenarios are required (section 6, `optimistic.e2e.test.ts`).

   Until that change lands, Steps 1 to 14 are complete and correct as they stand.
8. **Toggling a to-do is already optimistic** (`toggleTodo` in `frontend/src/context/TodoContext.tsx`). The checkbox and the `completed` class change immediately, **before** the PATCH request has finished. If a test toggles and then immediately reloads the page, the reload can abort the request and the change is lost, so the test fails at random. Before any reload, wait until the **server** reports the new state (`TodoPage.toggle()` and `waitForSaved()` in Step 8 do this by asking the API from inside the page). Use the same helpers after add and delete too, so the suite stays correct once those become optimistic.

   Note that "the server has it" and "the UI has finished with it" are different moments. With optimistic add the server can hold the row before the browser has processed the response, so `waitForSaved` alone does not mean the row is clickable (item 13).
9. **The to-do input and Add button are `disabled`** while the list is loading or a create is in flight. Typing into a disabled input throws `ElementNotInteractableError`, so "ready" means "input enabled", not just "input present". `TodoPage.typeTitle()` waits for this.
10. **Titles are trimmed by the server** (and by the form), so `"  Buy milk  "` is stored and shown as `Buy milk`.
11. **Titles are rendered as text**, so HTML characters such as `<b>` appear literally and are not interpreted.
12. **Use passwords of 8 or more characters in login tests too.** The `minLength=8` attribute is on the login form as well. Because the attribute is not reliably enforced (item 3), a short password may or may not reach the server, and which message appears is not worth depending on. A "wrong password" test must use a wrong password of 8 or more characters so that the server's "Invalid email or password" is the only possible outcome.
13. **(Applies once optimistic add/delete is implemented.) Pending rows are inert.** A just-added row carries a `pending` class and `aria-busy="true"`, and its checkbox and delete button are disabled, until the server replies and the row is swapped for the real one (which is a *different* DOM element, so any element reference taken earlier goes stale). Tests must wait for the row to be **settled** (present, not pending) before toggling or deleting it, and must re-find the row afterwards. `TodoPage.waitUntilSettled()` (Step 15) does this. Selenium will not tell you the click was ignored.
14. **Simulating a failing server.** Do not stop the backend container: it is slow (restart plus health wait) and affects later tests. Use Chrome's network emulation instead (`driver.setNetworkConditions`, available on the Chrome driver): `offline: true` makes every request from the page fail immediately, and a non-zero `latency` holds every request open so the "request in flight" state can be observed. Emulation applies to the whole page, **including the `serverTodos()` helper**, so restore the network before calling `waitForSaved` / `toggle`. Always restore it in `afterEach`.

### 3.6 Selectors available today

Prefer accessible attributes (labels, roles, `aria-label`) where they exist; these class names are the stable hooks in the current markup:

| Element | Selector |
|---|---|
| Auth card | `.auth-forms` (a `<main>`) |
| Auth heading | `.auth-forms h1` |
| Email / password inputs | `.auth-forms input[type="email"]`, `.auth-forms input[type="password"]` |
| Auth submit | `.auth-forms button[type="submit"]` |
| Switch mode link | `.auth-forms .link-button` |
| Any alert/error | `[role="alert"]` |
| To-do screen root | `.todo-app` |
| Navbar title | `.navbar h1` |
| Account area | `.account-settings`; email `.account-email` |
| Log out | the button in `.account-settings` whose text is "Log out" |
| Delete account | `.account-settings button.danger` (first one, before confirming) |
| Confirm delete | `.account-settings button.confirm` |
| New-to-do input | `.todo-list input[type="text"]` |
| Add button | `.todo-list .add-button` (`aria-label="Add"`) |
| Rows | `.todo-list li.todo-item` |
| Row title | `label > span:last-of-type` inside the row |
| Row checkbox (hidden) / icon | `input.checkbox-input` / `.checkbox-icon` |
| Row delete | `button.delete-button` |

## 4. Target layout

New files (nothing existing is moved):

```
EX2/
├── docker-compose.e2e.yml          # NEW  throwaway stack for the tests
├── SeleniumEnd2EndTestingPlan.md   # this document
├── README.md                       # EDIT add an "End-to-end tests (Selenium)" section
├── .gitignore                      # EDIT ignore e2e/artifacts/
└── e2e/                            # NEW  the test package (own package.json)
    ├── package.json
    ├── tsconfig.json
    ├── vitest.config.ts
    ├── scripts/
    │   └── run.mjs                 # start stack, run tests, always tear down
    ├── src/
    │   ├── config.ts               # URLs, flags, timeouts
    │   ├── driver.ts               # builds the Chrome driver
    │   ├── globalSetup.ts          # waits until the stack answers
    │   ├── helpers/
    │   │   ├── users.ts            # unique email + password
    │   │   ├── strings.ts          # reads frontend en.json
    │   │   ├── serverMessages.ts   # backend error texts
    │   │   ├── artifacts.ts        # screenshot + HTML on failure
    │   │   └── network.ts          # (Step 15) go offline / add latency / restore
    │   └── pages/
    │       ├── BasePage.ts
    │       ├── AuthPage.ts
    │       ├── TodoPage.ts
    │       └── AccountMenu.ts
    └── tests/
        ├── smoke.e2e.test.ts
        ├── registration.e2e.test.ts
        ├── login.e2e.test.ts
        ├── todos.e2e.test.ts
        ├── emptyInput.e2e.test.ts
        ├── accountDeletion.e2e.test.ts
        ├── isolation.e2e.test.ts
        └── optimistic.e2e.test.ts      # (Step 15) only once add/delete are optimistic
```

Why a separate `e2e/` package: Selenium and Chrome-related dependencies stay out of the frontend and backend builds and Docker images.

## 5. Implementation steps

Work from the repository root (`EX2/`) unless a step says otherwise. **Do not commit anything**; the repo owner reviews first.

Prerequisites on your machine: Node 20+, npm, Docker Desktop running, Google Chrome installed.

---

### Step 1. Create the e2e Docker stack

**Why:** the tests need their own database and app, on their own ports, so they never touch your development data and can run next to the dev stack.

Create `docker-compose.e2e.yml` in the repo root:

```yaml
# Throwaway stack for the Selenium end-to-end tests. Run it through e2e/scripts/run.mjs
# (or `docker compose -p todo-e2e -f docker-compose.e2e.yml up --build -d`).
#
# Host ports are deliberately different from the dev stack (5173 / 3001) so both can run.
# The browser reaches both services as "localhost"; see SeleniumEnd2EndTestingPlan.md
# section 3.2 for why that matters (SameSite=Lax + Secure cookies).
services:
  neo4j-e2e:
    image: neo4j:5
    environment:
      NEO4J_AUTH: neo4j/e2e-test-password
    healthcheck:
      test: ["CMD-SHELL", "cypher-shell -u neo4j -p e2e-test-password 'RETURN 1' || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 30

  backend-e2e:
    build:
      context: ./backend
      target: runtime
    environment:
      NEO4J_URI: bolt://neo4j-e2e:7687
      NEO4J_USER: neo4j
      NEO4J_PASSWORD: e2e-test-password
      SESSION_SECRET: e2e-test-session-secret
      # Must equal the address the browser uses for the frontend, port included.
      FRONTEND_ORIGIN: http://localhost:5273
      PORT: 3000
    ports:
      - "3101:3000"
    depends_on:
      neo4j-e2e:
        condition: service_healthy

  frontend-e2e:
    build:
      context: ./frontend
      target: runtime
      args:
        # Baked into the JavaScript bundle at build time: the address the BROWSER uses for the API.
        VITE_API_URL: http://localhost:3101
    ports:
      - "5273:80"
    depends_on:
      - backend-e2e
```

**Notes for the implementer**

- The Neo4j container has no published port; only the backend needs it, over the Docker network.
- If you change `5273` or `3101`, change them in **all three** places: here (`FRONTEND_ORIGIN`, `VITE_API_URL`, the `ports:` lines) and in `e2e/src/config.ts` (Step 4).
- `-p todo-e2e` (project name) is used everywhere so this stack never collides with your dev containers.

**Expected result:** the file exists. You will start it in Step 2.

---

### Step 2. Prove the stack works by hand (before writing any test code)

**Why:** most early failures are environment problems (ports, cookies, build-time URL). Find them now, in a browser you can see, not later in a test.

1. Start the stack (the first build takes several minutes):

   ```sh
   docker compose -p todo-e2e -f docker-compose.e2e.yml up --build -d
   ```

2. Wait for the containers: `docker compose -p todo-e2e -f docker-compose.e2e.yml ps` should list all three as running. The backend may take 10 to 30 seconds after Neo4j is healthy.

3. In a **private/incognito Chrome window** (so cookies from your dev stack on `localhost:5173` cannot interfere; see section 3.2), open `http://localhost:5273`.

4. Do this by hand: click "Need an account? Register" → enter `manual-check@example.com` and `correct-horse-battery` → Register → you should land on the To-Dos screen → add a to-do → click "Log out" → log back in → the to-do should still be there.

5. Stop and wipe:

   ```sh
   docker compose -p todo-e2e -f docker-compose.e2e.yml down -v
   ```

**Expected result:** registration and login work, and you are **not** bounced back to the login screen. If you are, stop and read section 7 (cookie / CORS rows) before continuing.

---

### Step 3. Scaffold the `e2e/` package

1. Create the folder and initialise it:

   ```sh
   mkdir e2e
   cd e2e
   npm init -y
   npm install --save-dev selenium-webdriver vitest typescript @types/selenium-webdriver @types/node cross-env
   ```

   (`cross-env` makes `VAR=value command` work on Windows too.)

   Recent `selenium-webdriver` 4.x releases may ship their own TypeScript types. After installing, check `node_modules/selenium-webdriver/package.json` for a `"types"` field. If it is present, uninstall `@types/selenium-webdriver` (two sets of types conflict).

2. Edit `e2e/package.json`. Set `"type": "module"`, `"private": true`, and these scripts (keep the `devDependencies` npm generated):

   ```json
   {
     "name": "todo-e2e",
     "private": true,
     "type": "module",
     "scripts": {
       "stack:up": "docker compose -p todo-e2e -f ../docker-compose.e2e.yml up --build -d",
       "stack:down": "docker compose -p todo-e2e -f ../docker-compose.e2e.yml down -v",
       "test": "vitest run",
       "test:fast": "cross-env E2E_SKIP_SLOW=1 vitest run",
       "test:headed": "cross-env HEADED=1 vitest run",
       "e2e": "node scripts/run.mjs",
       "e2e:fast": "cross-env E2E_SKIP_SLOW=1 node scripts/run.mjs"
     }
   }
   ```

3. Create `e2e/tsconfig.json`:

   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ESNext",
       "moduleResolution": "Bundler",
       "strict": true,
       "esModuleInterop": true,
       "resolveJsonModule": true,
       "skipLibCheck": true,
       "noEmit": true,
       "types": ["node"]
     },
     "include": ["src", "tests", "vitest.config.ts"]
   }
   ```

4. Create `e2e/vitest.config.ts`:

   ```ts
   import { defineConfig } from "vitest/config";

   export default defineConfig({
     test: {
       include: ["tests/**/*.e2e.test.ts"],
       globalSetup: ["./src/globalSetup.ts"],
       testTimeout: 30_000,
       hookTimeout: 60_000,
       // One browser at a time at first. Tests use unique users, so parallel is possible later.
       fileParallelism: false,
       // No retries: a test that fails once is flaky and must be fixed (Step 11). A retry would
       // turn that failure into a silent pass. Only raise this for CI, and then report retried tests.
       retry: 0,
     },
   });
   ```

5. Append to the **root** `.gitignore`:

   ```
   # E2E test failure artefacts
   e2e/artifacts/
   ```

   (`node_modules/` is already ignored everywhere.)

**Expected result:** `cd e2e && npx tsc --noEmit` prints nothing (it may complain there are no input files until Step 4; that is fine).

---

### Step 4. Configuration module

Create `e2e/src/config.ts`:

```ts
// Everything environment-specific lives here, so tests never hard-code a URL.
// The defaults match docker-compose.e2e.yml.
export const config = {
  /** Where the browser loads the frontend. Must use "localhost" (see plan section 3.2). */
  baseUrl: process.env.E2E_BASE_URL ?? "http://localhost:5273",
  /** Where the backend is published. Used only for readiness checks. */
  apiUrl: process.env.E2E_API_URL ?? "http://localhost:3101",
  /** Show the browser window. */
  headed: process.env.HEADED === "1",
  /** Skip tests that are slow by nature (the 15-second message expiry). */
  skipSlow: process.env.E2E_SKIP_SLOW === "1",
  /** Default ceiling for an explicit wait, in milliseconds. */
  waitMs: 10_000,
};
```

---

### Step 5. Driver factory

Create `e2e/src/driver.ts`:

```ts
import { Browser, Builder, type WebDriver } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { config } from "./config";

export async function createDriver(): Promise<WebDriver> {
  const options = new chrome.Options();
  options.addArguments("--window-size=1280,900", "--disable-gpu", "--no-sandbox");
  if (!config.headed) options.addArguments("--headless=new");

  const driver = await new Builder().forBrowser(Browser.CHROME).setChromeOptions(options).build();
  await driver.manage().setTimeouts({ pageLoad: 30_000, script: 10_000 });
  return driver;
}

/**
 * Returns the browser to a logged-out, empty state. Cookies are per host, so the
 * browser must be on the app before they can be cleared.
 */
export async function resetBrowser(driver: WebDriver): Promise<void> {
  await driver.get(config.baseUrl);
  await driver.manage().deleteAllCookies();
  await driver.get(config.baseUrl);
}
```

**Notes**

- `--no-sandbox` is needed in some containers/CI; harmless locally.
- The first run may take a while: Selenium Manager downloads a matching ChromeDriver. It needs internet access once.

---

### Step 6. Wait for the stack before any test runs

**Why:** `docker compose up -d` returns before the backend is ready. Without this, the first test fails randomly.

Create `e2e/src/globalSetup.ts`:

```ts
import { config } from "./config";

async function waitForUrl(url: string, timeoutMs: number, init?: RequestInit): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      // Any non-5xx response (even a 401) proves the server is up. A 5xx means the server is
      // answering but something behind it (usually the database) is not ready yet.
      const response = await fetch(url, init);
      if (response.status < 500) return;
      lastError = new Error(`HTTP ${response.status}`);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error(`Timed out waiting for ${url}. Last error: ${String(lastError)}`);
}

export default async function setup(): Promise<void> {
  // A login attempt with unknown credentials makes the backend query Neo4j and then answer 401.
  // (GET /api/auth/me with no cookie answers 401 *before* touching the database, so it would
  // prove only that the HTTP server is up, not that the database connection works.)
  await waitForUrl(`${config.apiUrl}/api/auth/login`, 120_000, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "readiness-probe@example.com", password: "not-a-real-password" }),
  });
  await waitForUrl(config.baseUrl, 120_000);
}
```

The expected status for the probe is 401. The fixed 1-second pause inside the retry loop is a polling interval for the readiness check, not a sleep inside a test.

---

### Step 7. Helpers

**`e2e/src/helpers/users.ts`**

```ts
export const TEST_PASSWORD = "correct-horse-battery"; // 8+ characters

/** A unique, lower-case email, so tests never depend on each other's data. */
export function uniqueEmail(label = "user"): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `e2e-${label}-${Date.now()}-${random}@example.com`;
}
```

**`e2e/src/helpers/strings.ts`**

```ts
import en from "../../../frontend/src/i18n/en.json";

/** Looks up a UI string by dotted key, filling {placeholders}. Mirrors the app's own t(). */
export function t(key: string, params: Record<string, string | number> = {}): string {
  let node: unknown = en;
  for (const part of key.split(".")) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  if (typeof node !== "string") throw new Error(`Missing UI string: ${key}`);
  return node.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
```

**`e2e/src/helpers/serverMessages.ts`**

```ts
// Texts produced by the backend, not by en.json. Keep in sync with backend/src/routes/api/auth.
export const serverMessages = {
  emailTaken: "An account with this email already exists",
  badCredentials: "Invalid email or password",
  // The backend requires a dot in the domain; Chrome's type="email" does not (e.g. "user@localhost").
  invalidEmail: "A valid email is required",
  // Normally Chrome's minLength would block a short password first, but this app's controlled
  // input clears Chrome's "user edited" flag, so the request reaches the server (section 3.5 item 3).
  passwordTooShort: "Password must be at least 8 characters",
};
```

**`e2e/src/helpers/artifacts.ts`**

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WebDriver } from "selenium-webdriver";

// This package is an ES module, where `__dirname` does not exist by definition.
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../artifacts");

/** Saves a screenshot and the page HTML so a failure can be diagnosed afterwards. */
export async function saveArtifacts(driver: WebDriver, testName: string): Promise<void> {
  const safe = testName.replace(/[^a-z0-9]+/gi, "-").slice(0, 80);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${stamp}-${safe}.png`), await driver.takeScreenshot(), "base64");
  await writeFile(path.join(dir, `${stamp}-${safe}.html`), await driver.getPageSource());
}
```

---

### Step 8. Page Objects

Each page object takes a `WebDriver`, exposes **actions** (verbs) and **questions** (read-only), and always waits explicitly.

**`e2e/src/pages/BasePage.ts`**

```ts
import { By, until, type WebDriver, type WebElement } from "selenium-webdriver";
import { config } from "../config";

export abstract class BasePage {
  constructor(protected readonly driver: WebDriver) {}

  /** Waits for the element to exist in the DOM. */
  protected async find(locator: By): Promise<WebElement> {
    return this.driver.wait(until.elementLocated(locator), config.waitMs);
  }

  /** Waits for the element to exist and be visible. */
  protected async visible(locator: By): Promise<WebElement> {
    const element = await this.find(locator);
    await this.driver.wait(until.elementIsVisible(element), config.waitMs);
    return element;
  }

  /**
   * Waits until a condition returns a truthy value, retrying (handy for re-rendered rows).
   * `timeoutMs` defaults to config.waitMs; raise it only for conditions that are slow by nature.
   */
  protected async waitUntil<T>(
    description: string,
    condition: () => Promise<T | false | null | undefined>,
    timeoutMs: number = config.waitMs,
  ): Promise<T> {
    // Errors thrown by the condition are retried (stale element, not there yet), but the last
    // one is remembered and added to the timeout message. Without it a typo'd selector or an
    // ElementNotInteractableError would only ever show up as "Timed out waiting for: ...".
    let lastError: unknown;
    try {
      const result = await this.driver.wait(async () => {
        try {
          const value = await condition();
          lastError = undefined;
          return value || false;
        } catch (error) {
          lastError = error;
          return false;
        }
      }, timeoutMs, `Timed out waiting for: ${description}`);
      return result as T;
    } catch (error) {
      if (lastError === undefined) throw error;
      throw new Error(`${(error as Error).message}. Last error while waiting: ${String(lastError)}`);
    }
  }
}
```

**`e2e/src/pages/AuthPage.ts`**

```ts
import { By } from "selenium-webdriver";
import { config } from "../config";
import { t } from "../helpers/strings";
import { BasePage } from "./BasePage";

const heading = By.css(".auth-forms h1");
const email = By.css('.auth-forms input[type="email"]');
const password = By.css('.auth-forms input[type="password"]');
const submit = By.css('.auth-forms button[type="submit"]');
const switchLink = By.css(".auth-forms .link-button");
const alert = By.css('.auth-forms [role="alert"]');

export class AuthPage extends BasePage {
  async open(): Promise<void> {
    await this.driver.get(config.baseUrl);
    await this.visible(heading);
  }

  async headingText(): Promise<string> {
    return (await this.visible(heading)).getText();
  }

  async showRegister(): Promise<void> {
    if ((await this.headingText()) === t("auth.register.heading")) return;
    await (await this.visible(switchLink)).click();
    await this.waitUntil("register heading", async () => (await this.headingText()) === t("auth.register.heading"));
  }

  async showLogin(): Promise<void> {
    if ((await this.headingText()) === t("auth.login.heading")) return;
    await (await this.visible(switchLink)).click();
    await this.waitUntil("login heading", async () => (await this.headingText()) === t("auth.login.heading"));
  }

  async fill(emailValue: string, passwordValue: string): Promise<void> {
    const emailInput = await this.visible(email);
    await emailInput.clear();
    await emailInput.sendKeys(emailValue);
    const passwordInput = await this.visible(password);
    await passwordInput.clear();
    await passwordInput.sendKeys(passwordValue);
  }

  async submit(): Promise<void> {
    await (await this.visible(submit)).click();
  }

  async register(emailValue: string, passwordValue: string): Promise<void> {
    await this.showRegister();
    await this.fill(emailValue, passwordValue);
    await this.submit();
  }

  async login(emailValue: string, passwordValue: string): Promise<void> {
    await this.showLogin();
    await this.fill(emailValue, passwordValue);
    await this.submit();
  }

  /** Text of the error alert; waits for it to appear. */
  async errorText(): Promise<string> {
    return (await this.visible(alert)).getText();
  }

  async hasError(): Promise<boolean> {
    return (await this.driver.findElements(alert)).length > 0;
  }

  /**
   * True when Chrome's own form validation rejects the current field values (no request was sent).
   * Note: Chrome only reports "too short" (`minLength`) for values whose last change was a user
   * edit, and `checkValidity()` has the same rule. In this app the controlled input re-assigns its
   * value on every keystroke, so this currently returns false for a short password even though
   * `fill()` uses real key events. Use it only inside an "either outcome" assertion (section 3.5
   * item 3), never as the sole expectation.
   */
  async formIsInvalid(): Promise<boolean> {
    const input = await this.visible(password);
    return this.driver.executeScript<boolean>("return !arguments[0].form.checkValidity()", input);
  }
}
```

**`e2e/src/pages/TodoPage.ts`**

```ts
import { By, Key, type WebElement } from "selenium-webdriver";
import { config } from "../config";
import { t } from "../helpers/strings";
import { BasePage } from "./BasePage";

interface ServerTodo {
  title: string;
  completed: boolean;
}

const root = By.css(".todo-app");
const input = By.css('.todo-list input[type="text"]');
const addButton = By.css(".todo-list .add-button");
const rows = By.css(".todo-list li.todo-item");
const alert = By.css('.todo-list [role="alert"]');
const title = By.css("label > span:last-of-type");
const checkboxInput = By.css("input.checkbox-input");
const checkboxIcon = By.css(".checkbox-icon");
const deleteButton = By.css("button.delete-button");

export class TodoPage extends BasePage {
  /** Waits for the signed-in screen and for the initial list fetch to finish. */
  async waitUntilReady(): Promise<void> {
    await this.visible(root);
    await this.waitUntilFormEnabled();
    await this.waitUntil("list finished loading", async () => {
      const source = await this.driver.getPageSource();
      return !source.includes(t("todos.loading"));
    });
  }

  /**
   * The input is disabled while the list loads or a create is in flight, so "enabled" is the
   * app's own readiness signal. Typing into a disabled input would throw.
   */
  private async waitUntilFormEnabled(): Promise<void> {
    await this.waitUntil("to-do form to be enabled", async () => (await this.visible(input)).isEnabled());
  }

  async navbarTitle(): Promise<string> {
    return (await this.visible(By.css(".navbar h1"))).getText();
  }

  async typeTitle(value: string): Promise<void> {
    await this.waitUntilFormEnabled();
    const field = await this.visible(input);
    await field.clear();
    await field.sendKeys(value);
  }

  async clickAdd(): Promise<void> {
    await (await this.visible(addButton)).click();
  }

  async addTodo(value: string): Promise<void> {
    await this.typeTitle(value);
    await this.clickAdd();
  }

  /**
   * Submits the form with the Enter key instead of the Add button. Pass a value to type first,
   * or omit it to press Enter in the input as it is (used for the empty-input scenarios).
   */
  async submitWithEnter(value?: string): Promise<void> {
    if (value !== undefined) await this.typeTitle(value);
    else await this.waitUntilFormEnabled();
    await (await this.visible(input)).sendKeys(Key.ENTER);
  }

  async inputValue(): Promise<string> {
    return (await this.visible(input)).getAttribute("value");
  }

  async titles(): Promise<string[]> {
    const found = await this.driver.findElements(rows);
    return Promise.all(found.map(async (row) => (await row.findElement(title)).getText()));
  }

  async rowCount(): Promise<number> {
    return (await this.driver.findElements(rows)).length;
  }

  private async findRow(value: string): Promise<WebElement | null> {
    for (const row of await this.driver.findElements(rows)) {
      if ((await row.findElement(title).getText()) === value) return row;
    }
    return null;
  }

  async waitForTitle(value: string): Promise<void> {
    await this.waitUntil(`row "${value}" to appear`, () => this.findRow(value));
  }

  async waitForTitleGone(value: string): Promise<void> {
    await this.waitUntil(`row "${value}" to disappear`, async () => (await this.findRow(value)) === null);
  }

  /**
   * Toggles the to-do and returns only once the SERVER has the new state. The checkbox flips
   * immediately (the app updates optimistically), so without this wait a following reload
   * could abort the request and lose the change (plan section 3.5, item 8).
   */
  async toggle(value: string): Promise<void> {
    const before = await this.isCompleted(value);
    const row = await this.waitUntil(`row "${value}"`, () => this.findRow(value));
    await row.findElement(checkboxIcon).click();
    await this.waitUntil(
      `server to report "${value}" as ${before ? "not completed" : "completed"}`,
      async () => (await this.serverTodos()).some((todo) => todo.title === value && todo.completed === !before),
    );
  }

  /** Waits until the server has a to-do with this title. Call before reloading the page. */
  async waitForSaved(value: string): Promise<void> {
    await this.waitUntil(`server to have "${value}"`, async () =>
      (await this.serverTodos()).some((todo) => todo.title === value),
    );
  }

  /** Waits until the server no longer has a to-do with this title. Call before reloading the page. */
  async waitForSavedGone(value: string): Promise<void> {
    await this.waitUntil(`server to no longer have "${value}"`, async () =>
      (await this.serverTodos()).every((todo) => todo.title !== value),
    );
  }

  /**
   * Asks the API for the signed-in user's to-dos from inside the page, so the (HttpOnly)
   * session cookie is sent. Returns [] if the request fails, which makes callers keep waiting.
   */
  private async serverTodos(): Promise<ServerTodo[]> {
    const result = await this.driver.executeAsyncScript<ServerTodo[] | null>(
      `const url = arguments[0];
       const done = arguments[arguments.length - 1];
       fetch(url, { credentials: "include" })
         .then((response) => response.json())
         .then((body) => done(body.todos ?? null), () => done(null));`,
      `${config.apiUrl}/api/todos`,
    );
    return result ?? [];
  }

  async isCompleted(value: string): Promise<boolean> {
    const row = await this.waitUntil(`row "${value}"`, () => this.findRow(value));
    return row.findElement(checkboxInput).isSelected();
  }

  async delete(value: string): Promise<void> {
    const row = await this.waitUntil(`row "${value}"`, () => this.findRow(value));
    await row.findElement(deleteButton).click();
  }

  async emptyStateVisible(): Promise<boolean> {
    return (await this.driver.getPageSource()).includes(t("todos.empty"));
  }

  async alertText(): Promise<string> {
    return (await this.visible(alert)).getText();
  }

  async hasAlert(): Promise<boolean> {
    return (await this.driver.findElements(alert)).length > 0;
  }

  async waitForAlertGone(description: string, timeoutMs?: number): Promise<void> {
    await this.waitUntil(description, async () => !(await this.hasAlert()), timeoutMs);
  }

  /**
   * Fails if the alert disappears before `ms` have passed, and returns once they have.
   * This is a polling wait with a deadline (not a fixed sleep): it checks the alert on every
   * poll and fails the moment it is gone. Used for the 15-second message-expiry test.
   */
  async expectAlertPersistsFor(ms: number): Promise<void> {
    const start = Date.now();
    await this.driver.wait(async () => {
      if (!(await this.hasAlert())) {
        throw new Error(`The alert disappeared after ${Date.now() - start} ms, expected it to last ${ms} ms`);
      }
      return Date.now() - start >= ms;
    }, ms + 5_000);
  }
}
```

**`e2e/src/pages/AccountMenu.ts`**

```ts
import { By } from "selenium-webdriver";
import { t } from "../helpers/strings";
import { BasePage } from "./BasePage";

const root = By.css(".todo-app .account-settings");
const email = By.css(".account-settings .account-email");
const deleteAccount = By.css(".account-settings button.danger");
const confirmDelete = By.css(".account-settings button.confirm");

function buttonWithText(text: string): By {
  return By.xpath(`//*[contains(@class,"account-settings")]//button[normalize-space()="${text}"]`);
}

export class AccountMenu extends BasePage {
  async shownEmail(): Promise<string> {
    return (await this.visible(email)).getText();
  }

  async logOut(): Promise<void> {
    await (await this.visible(buttonWithText(t("account.logout")))).click();
  }

  async startDelete(): Promise<void> {
    await (await this.visible(deleteAccount)).click();
    await this.visible(confirmDelete);
  }

  async confirmDeletion(): Promise<void> {
    await (await this.visible(confirmDelete)).click();
  }

  async cancelDeletion(): Promise<void> {
    await (await this.visible(buttonWithText(t("account.cancel")))).click();
  }

  async confirmationVisible(): Promise<boolean> {
    return (await this.driver.getPageSource()).includes(t("account.deleteConfirmation"));
  }

  async isVisible(): Promise<boolean> {
    return (await this.driver.findElements(root)).length > 0;
  }
}
```

---

### Step 9. First test: the smoke test

Write one test that exercises the whole chain (browser → frontend → backend → database) and get it green before writing anything else.

**`e2e/tests/smoke.e2e.test.ts`**

```ts
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { WebDriver } from "selenium-webdriver";
import { createDriver, resetBrowser } from "../src/driver";
import { saveArtifacts } from "../src/helpers/artifacts";
import { t } from "../src/helpers/strings";
import { TEST_PASSWORD, uniqueEmail } from "../src/helpers/users";
import { AuthPage } from "../src/pages/AuthPage";
import { TodoPage } from "../src/pages/TodoPage";

let driver: WebDriver;

beforeAll(async () => {
  driver = await createDriver();
});
afterAll(async () => {
  await driver?.quit();
});
beforeEach(async () => {
  await resetBrowser(driver);
});
afterEach(async ({ task }) => {
  if (task.result?.state !== "fail") return;
  try {
    await saveArtifacts(driver, task.name);
  } catch (error) {
    // A crashed browser must not replace the test's real failure with an artefact error.
    console.warn(`Could not save failure artefacts: ${String(error)}`);
  }
});

describe("smoke", () => {
  it("registers a user and adds a to-do", async () => {
    const auth = new AuthPage(driver);
    const todos = new TodoPage(driver);

    await auth.open();
    expect(await driver.getTitle()).toBe(t("app.title"));
    await auth.register(uniqueEmail("smoke"), TEST_PASSWORD);

    await todos.waitUntilReady();
    expect(await todos.navbarTitle()).toBe(t("navbar.todos"));

    await todos.addTodo("Buy milk");
    await todos.waitForTitle("Buy milk");
    expect(await todos.titles()).toEqual(["Buy milk"]);
  });
});
```

Run it:

```sh
cd e2e
npm run stack:up       # first time: several minutes
npm test               # runs the suite against the running stack
npm run stack:down
```

**Expected result:** one passing test. If it fails, section 7 maps symptoms to causes. Do **not** write the remaining tests until this passes.

> The `afterEach(async ({ task }) => ...)` form needs Vitest 1.x or newer. If your installed version complains, use `afterEach(async (context) => { if (context.task.result?.state === "fail") ... })`.

---

### Step 10. Write the remaining scenarios

Create the other test files listed in section 4, each with the **same lifecycle block** as the smoke test (`beforeAll` creates the driver, `afterAll` quits it, `beforeEach` calls `resetBrowser`, `afterEach` saves artefacts on failure). Copy it, don't invent variations.

Rules for every test:

1. **Each test registers its own user** with `uniqueEmail(...)`. No test may rely on another test's data or order.
2. **Use waits, never sleeps.** Use the page-object `waitFor...` / `waitUntil` methods.
3. **Assert on user-visible outcomes** (text, rows, which screen is showing), not on implementation details.
4. **Use unique, simple to-do titles** (letters, digits, spaces; no quotes). The one deliberate exception is the HTML-characters scenario in section 6.
5. **The 15-second test** is wrapped in `it.skipIf(config.skipSlow)(...)`, so `npm run test:fast` omits it. Give it its own timeout as the third argument, because it legitimately runs longer than the 30-second default once registration is included: `it.skipIf(config.skipSlow)("...", async () => { ... }, 60_000)`. Use `expectAlertPersistsFor(10_000)` followed by `waitForAlertGone(..., 10_000)`; do not write a sleep.
6. **Wait for the server before reloading.** Any test that changes data and then calls `driver.navigate().refresh()` must first call `waitForSaved(...)`, `waitForSavedGone(...)` or `toggle(...)` (which waits by itself). Reloading while a request is still in flight can drop the change (section 3.5, item 8).

The exact assertions for every scenario are in section 6. Implement them in this order, running the suite after each file: `registration`, `login`, `todos`, `emptyInput`, `accountDeletion`, `isolation`.

---

### Step 11. Make it reliable

1. **Run the whole suite 3 times in a row.** All three runs must pass. Any test that fails once is flaky; fix the wait, do not add a sleep. `retry` is `0` in `vitest.config.ts` precisely so that a single failure is visible rather than silently retried.
2. **Prove the tests can fail.** Temporarily break one behaviour (for example, in `frontend/src/components/TodoList.tsx`, stop `showTitleRequired()` from being called), rebuild the stack (`npm run stack:up`), and confirm the empty-input test fails and leaves a screenshot in `e2e/artifacts/`. Revert the change.
3. **Check the artefacts work.** After the deliberate failure, open the saved `.png` and `.html`. They should show the page at the moment of failure.
4. **Headed run.** `npm run test:headed` should open a visible Chrome and replay a scenario. Useful for debugging.

---

### Step 12. One-command runner

**Why:** people forget to tear the stack down. This script always does.

Create `e2e/scripts/run.mjs`:

```js
// Starts the e2e stack, runs the tests, and always tears the stack down afterwards.
// Set E2E_KEEP_STACK=1 to leave it running for faster repeat runs.
//
// No shell is used anywhere: with `shell: true` Node joins arguments without quoting them, so
// `-t "adds a to-do"` would be split into three arguments on Windows. `docker` is a real
// executable and Vitest is started through the current Node binary, so neither needs a shell.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vitest = path.join(root, "node_modules", "vitest", "vitest.mjs");
const compose = ["compose", "-p", "todo-e2e", "-f", path.join(root, "..", "docker-compose.e2e.yml")];
const run = (command, args) => spawnSync(command, args, { stdio: "inherit", cwd: root });

// Ctrl+C is delivered to this process and to the child. Without a handler Node would exit
// immediately and skip the `finally` below, leaving the stack running. With a (no-op) handler the
// child stops, `spawnSync` returns, and the teardown still happens.
process.on("SIGINT", () => {});

let status = 1;
try {
  if (run("docker", [...compose, "up", "--build", "-d"]).status !== 0) {
    throw new Error("The e2e stack failed to start");
  }
  // Extra CLI arguments are passed to Vitest, e.g. `npm run e2e -- tests/todos.e2e.test.ts`
  // or `npm run e2e -- -t "adds a to-do"`.
  status = run(process.execPath, [vitest, "run", ...process.argv.slice(2)]).status ?? 1;
} finally {
  if (process.env.E2E_KEEP_STACK !== "1") run("docker", [...compose, "down", "-v"]);
}
process.exit(status);
```

**Expected result:** `cd e2e && npm run e2e` builds, tests, and tears down in one go, and exits non-zero on failure.

---

### Step 13. Document it in the README

Edit the root `README.md`. Insert this section **between** "### Frontend unit tests" and "## Local development without Docker", inside the existing "## Running the tests" part. Match the tone and formatting of the neighbouring sections.

````markdown
### End-to-end tests (Selenium)

Drives the real app in a real Chrome browser: registering, logging in and out, adding / completing / deleting to-dos, the empty-input error, and deleting an account. It runs against its own throwaway stack (separate Neo4j, backend and frontend on ports **3101** and **5273**), so it never touches your development data and can run next to `docker compose up`.

**Requirements:** Docker, Node 20+, and Google Chrome installed on the machine running the tests (the matching ChromeDriver is downloaded automatically on first run, which needs internet access).

```sh
cd e2e
npm install
npm run e2e          # start the stack, run every test, tear the stack down
```

Useful variations:

```sh
npm run e2e:fast                              # skip the slow 15-second message-expiry test
npm run e2e -- tests/todos.e2e.test.ts        # one test file
npm run e2e -- -t "adds a to-do"              # tests whose name matches
npm run test:headed                           # watch the browser (stack must already be running)
```

Keeping the stack running between runs is much faster while you are writing tests:

```sh
npm run stack:up      # build and start (first time takes several minutes)
npm test              # run the tests against the running stack, as often as you like
npm run stack:down    # stop and delete the stack and its data
```

Setting `E2E_KEEP_STACK=1` makes `npm run e2e` leave the stack up.

**When a test fails**, a screenshot and the page HTML are saved in `e2e/artifacts/` (git-ignored). Re-run just that test with `npm run test:headed -- -t "<name>"` to watch it.

**Troubleshooting**

- *Login "works" and then bounces back to the login screen:* the browser must use `localhost` for both the app and the API (the session cookie is `SameSite=Lax` and `Secure`). Do not open the app by Docker service name.
- *CORS errors in the console, or "Failed to fetch":* `FRONTEND_ORIGIN` and `VITE_API_URL` in `docker-compose.e2e.yml` must match the ports the browser uses. `VITE_API_URL` is baked into the frontend at build time, so rebuild (`npm run stack:up`) after changing it.
- *Timeouts at the start of a run:* Neo4j can take a minute to become healthy on a cold start. The suite waits up to two minutes.
- *Port already in use:* something else holds 3101 or 5273; change the ports in `docker-compose.e2e.yml` and `e2e/src/config.ts`.
- *Checking the e2e app by hand while your dev stack is also open:* cookies are shared between ports on `localhost`, so one login replaces the other. Use a private window or a separate Chrome profile for each.
- *The stack is still running after pressing Ctrl+C:* run `npm run stack:down`.

**Adding a test:** put it in `e2e/tests/*.e2e.test.ts`, register a fresh user with `uniqueEmail()`, drive the UI only through the page objects in `e2e/src/pages/`, and use the explicit-wait helpers (never fixed sleeps). UI text comes from `frontend/src/i18n/en.json` via `e2e/src/helpers/strings.ts`.
````

Do not duplicate the README's existing prerequisites section; link to it if more detail is wanted.

---

### Step 14. Final verification

Run each of these and confirm the expected result:

| # | Command / action | Expected |
|---|---|---|
| 1 | `cd e2e && npx tsc --noEmit` | No errors |
| 2 | `cd e2e && npm run e2e` from a clean state (no containers running) | All tests pass; stack is gone afterwards (`docker ps` shows no `todo-e2e` containers) |
| 3 | `npm run e2e` three times in a row | Three passes |
| 4 | `npm run e2e:fast` | Passes, skipping only the 15-second test |
| 5 | Run the dev stack (`docker compose up`) and `npm run e2e` at the same time | No port conflict; both work (if you also open both apps by hand, use separate browser profiles, see section 3.2) |
| 5a | `npm run e2e -- -t "adds a to-do with the Add button"` (a name containing spaces) | Only the matching test runs; the quoted name is not split |
| 5b | Start `npm run e2e`, press Ctrl+C part-way through | The stack is torn down (`docker ps` shows no `todo-e2e` containers) |
| 6 | Break one behaviour on purpose, rebuild, run | The matching test fails and writes a `.png` and `.html` to `e2e/artifacts/` |
| 7 | `cd frontend && npm test` and `cd backend && npm test` | Unchanged and passing (the e2e package must not affect them) |
| 8 | Follow the README section on a machine that has not run it before | The commands work as written |

---

### Step 15. Adapt the suite when add/delete become optimistic

**When:** in the same change that implements `OptimisticAddDeletePlan.md` (its Step 7 points here). Not before: until then these helpers are harmless but unused, and `optimistic.e2e.test.ts` would fail because the app does not behave that way yet.

**Why:** section 3.5 items 7, 8 and 13. Summary: new rows are disabled until the server replies, Selenium silently ignores clicks on disabled controls, and the existing tests cannot distinguish optimistic from non-optimistic behaviour.

**15.1 `TodoPage`: wait for a row to be settled.** Add:

```ts
/** True while the row exists and is still waiting for its server id (optimistic add). */
async isPending(value: string): Promise<boolean> {
  const row = await this.waitUntil(`row "${value}"`, () => this.findRow(value));
  return (await row.getAttribute("aria-busy")) === "true";
}

/** Waits until the row exists and is no longer pending, i.e. it can be toggled or deleted. */
async waitUntilSettled(value: string): Promise<void> {
  await this.waitUntil(`row "${value}" to settle`, async () => {
    const row = await this.findRow(value);
    return row !== null && (await row.getAttribute("aria-busy")) !== "true";
  });
}

/** True when the row's checkbox and delete button are both enabled. */
async controlsEnabled(value: string): Promise<boolean> {
  const row = await this.waitUntil(`row "${value}"`, () => this.findRow(value));
  return (
    (await row.findElement(checkboxInput).isEnabled()) && (await row.findElement(deleteButton).isEnabled())
  );
}

/** Adds a to-do and returns once the row is settled and the server has it. */
async addAndSettle(value: string): Promise<void> {
  await this.addTodo(value);
  await this.waitForTitle(value);
  await this.waitUntilSettled(value);
  await this.waitForSaved(value);
}
```

Then call `await this.waitUntilSettled(value)` as the **first line** of `toggle()` and of `delete()`. `findRow` is re-run on every poll, so the row swap (a new DOM element) is handled.

**15.2 `e2e/src/helpers/network.ts`** (new), a thin wrapper so tests do not repeat the emulation parameters:

```ts
import type { WebDriver } from "selenium-webdriver";
import type { Driver as ChromeDriver } from "selenium-webdriver/chrome.js";

// createDriver() returns a Chrome driver, which has setNetworkConditions.
const chrome = (driver: WebDriver) => driver as unknown as ChromeDriver;

export async function goOffline(driver: WebDriver): Promise<void> {
  await chrome(driver).setNetworkConditions({
    offline: true,
    latency: 0,
    download_throughput: -1,
    upload_throughput: -1,
  });
}

/** Holds every request open for about `ms` milliseconds so the "in flight" state is observable. */
export async function addLatency(driver: WebDriver, ms: number): Promise<void> {
  await chrome(driver).setNetworkConditions({
    offline: false,
    latency: ms,
    download_throughput: -1,
    upload_throughput: -1,
  });
}

export async function restoreNetwork(driver: WebDriver): Promise<void> {
  await chrome(driver).setNetworkConditions({
    offline: false,
    latency: 0,
    download_throughput: -1,
    upload_throughput: -1,
  });
}
```

If `tsc` rejects the cast or the exact parameter names on your installed `@types/selenium-webdriver`, check `node_modules/selenium-webdriver/chromium.js` (`setNetworkConditions`) for the expected object. In the test lifecycle add `await restoreNetwork(driver)` to `afterEach`, **before** saving artefacts, so a failed test cannot leave the browser offline for the next one (and so `saveArtifacts` can reach the page).

**15.3 Existing tests.** In `todos.e2e.test.ts`:

- Replace "add, `waitForTitle`" with `addAndSettle(...)` wherever the row is toggled or deleted straight afterwards (tests: marks completed, deletes, shows empty state).
- "shows the empty state after deleting the last to-do": after `waitForTitleGone` add `await todos.waitForSavedGone("Only item")`, then assert the empty state. Otherwise a rolled-back delete would still pass.
- "lists to-dos in the order they were added": after the three adds call `waitForSaved` for each, **reload**, and assert the order again. With optimistic add the local order is no longer evidence of the server order (concurrent POSTs).

**15.4 New `optimistic.e2e.test.ts`** with the scenarios in section 6. Keep it small: the unit tests own the exhaustive rollback logic; these confirm it works in a real browser, with a real network and the real cookie.

**Expected result:** the whole suite, including the new file, passes three runs in a row with `retry: 0`. As a sanity check, temporarily revert the optimistic change in the frontend and confirm `optimistic.e2e.test.ts` fails (and the older tests still pass).

---

## 6. Scenario reference

Notation: **Given** a starting state, **When** an action, **Then** what to assert. `A` is a freshly generated user. "On the to-do screen" means `TodoPage.waitUntilReady()` returns.

### `registration.e2e.test.ts`

| Test | Steps and assertions |
|---|---|
| registers a new user and lands on the to-do screen | Open app; `register(A)`; wait for the to-do screen; navbar title is `t("navbar.todos")`; `AccountMenu.shownEmail()` equals A's email; the list shows `t("todos.empty")` |
| shows an error for an email that already exists | Register A; log out; on the login screen switch to register; register A again; `AuthPage.errorText()` equals `serverMessages.emailTaken`; still on the auth screen |
| does not register a password shorter than 8 characters | Show register; fill a valid email and `"short"`; submit; the heading is still `t("auth.register.heading")`; and **either** `formIsInvalid()` is true (browser blocked it) **or** `errorText()` equals `serverMessages.passwordTooShort` (server rejected it). Today the second case happens (section 3.5 item 3) |
| shows the server's error for an email Chrome accepts but the server rejects | Show register; fill `user@localhost` and a password of 8 or more characters; submit; `errorText()` equals `serverMessages.invalidEmail`; still on the auth screen |
| can switch between login and register | Heading starts as `t("auth.login.heading")`; click the switch link; heading is `t("auth.register.heading")`; click again; back to login |

### `login.e2e.test.ts`

| Test | Steps and assertions |
|---|---|
| logs in with valid credentials | Register A; log out; `login(A)`; to-do screen shown; shown email equals A's |
| rejects a wrong password | Register A; log out; `login` with the right email and a different password **of 8 or more characters** (so the server's message is the only possible outcome, section 3.5 item 12); `errorText()` equals `serverMessages.badCredentials`; still on the auth screen |
| rejects an unknown email | `login` with a never-registered email and a password of 8 or more characters; `errorText()` equals `serverMessages.badCredentials` |
| treats the email as case-insensitive | Register with a mixed-case email such as `E2E-Case-<unique>@Example.com`; `AccountMenu.shownEmail()` equals the lower-case form; log out; `login` with the lower-case form; to-do screen shown |
| logs out and stays logged out after a reload | Register A; `logOut()`; heading is `t("auth.login.heading")`; `driver.navigate().refresh()`; still the login screen |
| keeps the session across a reload | Register A; refresh; to-do screen still shown with the same email |

### `todos.e2e.test.ts`

| Test | Steps and assertions |
|---|---|
| adds a to-do with the Add button | Register A; `addTodo("Buy milk")`; wait for the row; `titles()` equals `["Buy milk"]`; the input is empty again |
| adds a to-do by pressing Enter | `submitWithEnter("Enter title")`; the row appears; `titles()` equals `["Enter title"]` |
| lists to-dos in the order they were added | Add "First", "Second", "Third" (waiting for each); `titles()` equals that order |
| keeps to-dos after a reload | Add one; `waitForTitle`; `waitForSaved`; refresh; wait until ready; the row is still there |
| marks a to-do completed and keeps it so | Add one; `toggle` (returns only once the server has the change); `isCompleted` is true; refresh; wait until ready; still true; `toggle` again; `isCompleted` is false; refresh; still false |
| deletes a to-do and keeps it deleted | Add two; delete one; `waitForTitleGone`; `waitForSavedGone`; the other remains; refresh; wait until ready; still gone |
| shows the empty state after deleting the last to-do | Add one; delete it; `emptyStateVisible()` is true |
| trims whitespace around the title | Type `"  Padded title  "`; click Add; `waitForTitle("Padded title")`; `titles()` equals `["Padded title"]` |
| shows HTML characters as plain text | Add the title `<b>bold</b>`; `waitForTitle("<b>bold</b>")`; the row's visible text is exactly `<b>bold</b>` (it was not interpreted as markup) |

### `emptyInput.e2e.test.ts`

| Test | Steps and assertions |
|---|---|
| clicking Add with an empty input shows the error and adds nothing | Register A; `clickAdd()`; `alertText()` equals `t("todos.titleRequired")`; `rowCount()` is 0 |
| pressing Enter on an empty input shows the same error | `submitWithEnter()` with no value; same assertions |
| whitespace-only input is treated as empty | Type three spaces; `clickAdd()`; error shown; `rowCount()` is 0 |
| typing makes the error disappear | Trigger the error; type one character; `waitForAlertGone` |
| the error goes away by itself after 15 seconds *(slow, `skipIf(config.skipSlow)`, test timeout 60 s)* | Trigger the error; `expectAlertPersistsFor(10_000)` (fails if it vanishes early); `waitForAlertGone(..., 10_000)` (it must be gone within the remaining time). Optional: the same timer is also covered with fake timers in the frontend unit tests |
| a valid add clears the error | Trigger the error; type a title; click Add; no alert; the row exists |

### `accountDeletion.e2e.test.ts`

| Test | Steps and assertions |
|---|---|
| shows a confirmation before deleting | Register A; `startDelete()`; `confirmationVisible()` is true; the confirm button is present |
| cancelling keeps the account | `startDelete()`; `cancelDeletion()`; still on the to-do screen; confirmation text gone |
| confirming deletes the account and logs out | `startDelete()`; `confirmDeletion()`; heading is `t("auth.login.heading")` |
| a deleted account can no longer log in | After deleting, `login(A)`; `errorText()` equals `serverMessages.badCredentials` |
| a deleted user's to-dos are gone for good | Register A, add a to-do, delete the account; register the **same email** again; the list is empty (`t("todos.empty")`) |

### `isolation.e2e.test.ts`

| Test | Steps and assertions |
|---|---|
| one user never sees another user's to-dos | Register A; add "Private A"; log out; register B; list is empty; add "Private B"; log out; log in as A; `titles()` equals `["Private A"]` |

### `optimistic.e2e.test.ts` (Step 15, only once add/delete are optimistic)

Each test restores the network in `afterEach`. "Latency" and "offline" are the helpers from `helpers/network.ts`. Call `restoreNetwork` before using `waitForSaved`, `toggle` or any other helper that talks to the API from the page (section 3.5 item 14).

| Test | Steps and assertions |
|---|---|
| a new to-do appears before the server replies | Register A; wait ready; `addLatency(2000)`; `addTodo("Slow add")`; within the normal wait the row exists, `isPending("Slow add")` is true, the input is empty and **enabled**; `restoreNetwork`; `waitUntilSettled`; `waitForSaved`; refresh; the row is still there (no duplicate) |
| a pending row cannot be toggled or deleted | Same setup; while pending `controlsEnabled("Slow add")` is false; after settling it is true |
| a failed add is rolled back and the title returned | Register A; `goOffline`; `addTodo("Will fail")`; wait for the alert; `alertText()` equals `t("errors.createTodo")`; `rowCount()` is 0; `inputValue()` equals `"Will fail"`; `restoreNetwork`; refresh; list is empty |
| a failed delete is restored at its original position | Register A; `addAndSettle` "One", "Two", "Three"; `goOffline`; `delete("Two")`; wait for the alert; `alertText()` equals `t("errors.deleteTodo")`; `titles()` equals `["One","Two","Three"]`; `restoreNetwork`; `waitForSaved("Two")` |

For the two rollback tests assert the **final** state, not the intermediate "row vanished" state: with the network offline the request fails within milliseconds, so the row is gone for too short a time to observe reliably. The brief disappearance is covered by the unit tests; the e2e test proves the end state in a real browser.
| a double click on Add creates one to-do and no empty-title error | Register A; `addLatency(1500)`; `typeTitle("Once")`; `clickAdd()` twice in a row; `hasAlert()` is false; `rowCount()` is 1; `restoreNetwork`; `waitUntilSettled("Once")`; refresh; `titles()` equals `["Once"]` |
| several quick adds keep their order after a reload | Register A; `addTodo` "A", "B", "C" without waiting between them; wait until all three are settled and saved; refresh; `titles()` equals `["A","B","C"]`. If this ever fails, it is the ordering trade-off (`OptimisticAddDeletePlan.md` section 4, item 11), not a test bug |

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Login succeeds, then the app returns to the login screen | The cookie was dropped: the browser is not using `localhost` for both app and API (cross-site), or `FRONTEND_ORIGIN` does not match | Use `localhost` everywhere; check section 3.2 and the compose file |
| CORS error in the browser console | `FRONTEND_ORIGIN` does not equal the page origin exactly (port included) | Make `FRONTEND_ORIGIN` equal `http://localhost:5273` |
| Requests go to the wrong API address | Frontend image built with an old `VITE_API_URL` | `npm run stack:down`, then `npm run stack:up` (it rebuilds) |
| `ECONNREFUSED` or the whole suite times out at start | Stack not up yet, or ports not published | `docker compose -p todo-e2e -f ../docker-compose.e2e.yml ps` and `logs backend-e2e`; the global setup waits up to 2 minutes |
| `session not created: ... Chrome version` | Chrome too old/new for the driver, or Chrome not installed | Update Chrome; Selenium Manager picks the matching driver |
| `ElementNotInteractableError` on the checkbox | Clicking the hidden native input | Click `.checkbox-icon` (the page object already does) |
| `StaleElementReferenceError` | The list re-rendered between finding and clicking | Use `waitUntil`/the page-object methods that re-find the row |
| A test passes alone but fails in the suite | Shared state or timing assumption | Ensure the test registers its own user and waits on conditions |
| `Missing UI string: ...` | A key was renamed in `en.json` | Update the key in the test or helper |
| Short-password test fails on `formIsInvalid()` being false | Chrome's `minLength` check does not fire for this app's controlled input; the server rejected it instead | Assert the either-outcome form in section 6 (browser blocked **or** `serverMessages.passwordTooShort`) |
| "Wrong password" test shows an unexpected message or none | The password used was shorter than 8 characters, so the outcome is not the server's "Invalid email or password" | Use a password of 8 or more characters |
| After optimistic add: toggle/delete times out, or passes only sometimes | The row was still pending, so its controls were disabled and the click was silently ignored | Call `waitUntilSettled()` first (Step 15, section 3.5 item 13) |
| After optimistic add: `StaleElementReferenceError` on a row | The row was replaced by the server's version (new DOM element) between find and click | Re-find through the page-object methods; never hold a row element across a wait |
| A test after a failed rollback test is offline or very slow | Network emulation was not restored | `restoreNetwork` in `afterEach` (Step 15.2) |
| A toggle / add / delete test passes alone but fails now and then after a reload | The reload happened while the request was still in flight, so the change was lost | Call `toggle()` / `waitForSaved()` / `waitForSavedGone()` before reloading (section 3.5 item 8) |
| `ElementNotInteractableError` when typing in the to-do input | The input is disabled while the list loads or a create is in flight | Use `typeTitle()` / `addTodo()`, which wait for it to be enabled |
| Manually opened app logs you out of the other stack | Both stacks set the same cookie on `localhost` (cookies ignore ports) | Use a private window or separate Chrome profile for each stack |
| `npm run e2e -- -t "some name"` runs everything or errors | The runner was changed back to `shell: true`, which splits arguments on spaces | Keep `run.mjs` shell-free (Step 12) |
| Stack still running after Ctrl+C | Teardown was skipped | `npm run stack:down`; keep the `SIGINT` handler in `run.mjs` |
| Port 3101 or 5273 already in use | Another process holds it | Change the ports consistently (compose file and `config.ts`) |

## 8. Acceptance criteria

- `cd e2e && npm run e2e` starts the stack, runs every scenario in section 6, and tears the stack down, from a clean machine state.
- Every scenario in section 6 exists, with the assertions listed.
- The suite passes three times in a row.
- A deliberately broken behaviour makes the matching test fail and produces a screenshot and HTML in `e2e/artifacts/`.
- No fixed sleeps anywhere in `e2e/` (the 1-second polling interval in the readiness check in `globalSetup.ts` is the only timed pause, and it is not inside a test).
- `retry` is `0`, and the suite passes without retries.
- Every test that reloads the page after a change first waits for the server to have that change.
- **Once add/delete are optimistic (Step 15):** every test that toggles or deletes a row it just added waits for it to be settled first; `optimistic.e2e.test.ts` exists and passes; the network is restored after every test; and the suite still passes three runs in a row with `retry: 0`.
- `npm run e2e -- -t "<name with spaces>"` works on Windows, and Ctrl+C still tears the stack down.
- UI strings are read from `frontend/src/i18n/en.json`, not hard-coded (apart from the two server messages in `serverMessages.ts`).
- The README has the new section, and following it works.
- The existing frontend and backend test suites are unaffected.

## 9. Conventions for this repo

- **Do not commit** unless the owner asks. Leave all changes in the working tree for review.
- When a commit is requested, use the existing message style: a lower-case prefix such as `dev:` or `ref:`, then a short description.
- Do not change application source to make a test pass without raising it first. If a stable selector is genuinely missing, prefer adding a `data-testid` and say so in your summary.
- Keep Docker-related changes confined to `docker-compose.e2e.yml`; do not edit `docker-compose.yml` or `docker-compose.test.yml`.

## 10. Open decisions and follow-ups

- **Browsers:** Chrome only for now. Firefox could be added by parameterising `createDriver`.
- **CI:** a job could run `npm run e2e` on a runner that has Docker and Chrome (hosted Linux runners do). Upload `e2e/artifacts/` on failure. Not part of this change.
- **Parallelism:** `fileParallelism` is off. Because every test uses a unique user, it could be turned on later to cut run time, once the suite has proven stable.
- **Accessibility checks:** `@axe-core/webdriverjs` could assert the landmark, label and contrast fixes made earlier. Worth a follow-up.
- **Optimistic add/delete:** when `OptimisticAddDeletePlan.md` is implemented, **this suite needs changes**; it does not pass unchanged. Pending rows are inert and Selenium silently ignores clicks on them, so `TodoPage` needs `waitUntilSettled()` and some tests need `addAndSettle()`; and new rollback / in-flight scenarios are required because nothing here can tell optimistic from non-optimistic behaviour. All of that is Step 15 and the `optimistic.e2e.test.ts` table in section 6. Do it in the same change as the app change.
- **Server-error states:** `errors.createTodo` and `errors.deleteTodo` are covered by `optimistic.e2e.test.ts` (Step 15) using Chrome network emulation, which is faster and more deterministic than stopping the backend container. `errors.loadTodos` (offline during the initial fetch) and `errors.updateTodo` (offline during a toggle) are not covered yet; they follow the same pattern.
- **Make `minLength` actually work:** the password input's `minLength=8` is not enforced by Chrome because the input is controlled (section 3.5 item 3), so a short password costs a server round trip and shows a server message. If the app changes that (for example by checking length in `handleSubmit`), update the registration test, which is written to accept both outcomes.
- **Slow 15-second test:** if the frontend unit tests already cover the timer with fake timers, consider removing the e2e version to save about 15 seconds per run.
- **`data-testid` hooks:** the suite currently relies on existing class names and ARIA labels. If the markup changes often, adding test ids would make selectors more stable.
