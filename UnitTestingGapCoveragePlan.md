# Unit Testing Gap Coverage Plan

Close the remaining gaps in the frontend and backend **unit** test suites, and make coverage measurable from now on.

This document is written for a developer or another Claude instance picking up the work cold. It is self-contained: it says what was measured, which exact lines and branches are untested, which test to write for each, which ones are deliberately left alone, and how to verify.

---

## 1. Where we are

Measured with Vitest's V8 coverage on 2026-10-13, after the optimistic add/delete change (`OptimisticAddDeletePlan.md`) landed.

| Package | Tests | Statements | Branches | Functions | Lines |
|---|---|---|---|---|---|
| `frontend/` | 117 | 97.0% | 85.3% | 97.1% | 97.4% |
| `backend/` (unit only) | 94 | 89.1% | 80.6% | 84.9% | 90.5% |

Every source file not named in section 4 or 5 is already at 100% for every metric.

**Scope of "unit".** Backend integration tests (`backend/tests/integration/`, real Neo4j) and the Selenium suite (`e2e/`) are out of scope. They are not part of these numbers.

**There is no coverage tooling in the repo yet.** Neither `package.json` has a coverage provider or a coverage script. Step 0 adds one. The numbers above were produced by installing `@vitest/coverage-v8` temporarily with `--no-save`.

## 2. Goals and non-goals

**Goals**

1. Add the provider, a script and thresholds so coverage is a command, not an investigation (Step 0).
2. Cover every reachable untested path listed in sections 4 and 5.
3. Reach roughly **99% statements / 92% branches** on the frontend and **97% statements / 90% branches** on the backend (section 8).

**Non-goals**

- Chasing 100% branches. A few branches are defensive and unreachable through public behaviour (section 6). They are listed so nobody burns time on them.
- Changing application behaviour. Tests only, apart from the two optional `v8 ignore` comments in section 6.
- Integration or e2e tests.

## 3. Conventions to follow

- **Do not commit** unless asked; the owner reviews changes first. Commit messages, when requested, use the repo style: `dev:` or `ref:` prefix, lower case.
- Match the neighbouring tests. Frontend tests use `renderWithI18n` (`frontend/tests/helpers/renderWithI18n.tsx`), `@solidjs/testing-library`, and a local `deferred()` helper. Backend route tests import `../helpers/vinxiHttpMock` first, build events with `createMockEvent`, and mock `~/lib/neo4j` plus the repository.
- Assert on user-visible outcomes (text, status codes), not implementation details.
- No new hex colours, no hard-coded user-facing strings (use `t()` keys that already exist in `frontend/src/i18n/en.json`).
- Run only the package you are changing while iterating, then run both before finishing (section 7).

## 4. Frontend gaps

Work from `frontend/`. Tests live in `frontend/tests/`.

### F1. `TodoContext.tsx` (new optimistic paths; highest value)

All of these are branches added by the optimistic add/delete change and are not yet exercised. Add them to `tests/context/TodoContext.test.tsx`. The file's `Consumer` has hard-coded `toggle` / `delete` buttons for id `t1`, plus `toggle pending` / `delete pending`. Add two more buttons so unknown ids can be reached:

```tsx
<button type="button" onClick={() => toggleTodo("missing", true)}>toggle missing</button>
<button type="button" onClick={() => deleteTodo("missing")}>delete missing</button>
```

| # | Source (line approx.) | Scenario | Assertion |
|---|---|---|---|
| F1.1 | `createTodo` catch, `if (userChangedSince(ownerId)) return false` (~123) | Click create, `setMockUser(otherUser)`, then `create.reject(new Error("boom"))`, `await flushPromises()` | `error` still `none`; no `Failed to create to-do.`; other user's list untouched. Mirrors the existing "does not report a delete failure after the user has changed" test. |
| F1.2 | `toggleTodo` map, the `: todo` branch (~136) | `renderLoggedIn([buyMilk(), { id: "t9", title: "Other", completed: false }])`, click `toggle` | `t1:Buy milk:true:false` and `t9:Other:false:false` both present (the other row is unchanged). |
| F1.3 | `toggleTodo` success when the user changed (~142) | Click `toggle`, `setMockUser(otherUser)`, resolve the `setCompleted` deferred | `error` is `none`; the new user's list is untouched. |
| F1.4 | `toggleTodo` rollback, `previous === undefined` (~146) | Click `toggle missing` with `setCompleted` rejecting | Error `Failed to update to-do.` is shown and no row appears or changes (there was nothing to roll back to). |
| F1.5 | `deleteTodo`, `index === -1` (~156) | Click `delete missing` | `mockedDeleteTodo` not called; `error` is `none`. |
| F1.6 | `useTodos` throws outside a provider (~200-201) | Render a component that calls `useTodos()` with no `TodoProvider` | Throws `useTodos must be used within a TodoProvider`. Use `expect(() => render(...)).toThrow(...)`; with Solid, wrap in `createRoot` if `render` swallows it. |

### F2. `AccountSettings.tsx`

File: `tests/components/AccountSettings.test.tsx`. Lines 20 and 30 are the `catch` blocks of logout and delete-account. **Neither failure path has any test today.**

| # | Scenario | Assertion |
|---|---|---|
| F2.1 | `logout` rejects with `new ApiError(500, "Server down")` | Alert shows `Server down`; `setCurrentUser` not called. |
| F2.2 | `logout` rejects with a plain `new Error("boom")` | Alert shows the `account.logoutError` text. |
| F2.3 | Delete account: click Delete, then Confirm, `deleteAccount` rejects with `ApiError` | Alert shows the server message; `setCurrentUser` not called. |
| F2.4 | Same, with a plain `Error` | Alert shows the `account.deleteError` text. |
| F2.5 | A shown error is cleared by the next attempt (`setError(null)` at the top of each handler) | First `logout` rejects, second resolves; alert is gone after the second. |

Import `ApiError` from `~/api/client` (the test already mocks `~/api/auth`, not the client).

### F3. `AuthForms.tsx`

File: `tests/components/AuthForms.test.tsx`.

| # | Source | Scenario | Assertion |
|---|---|---|---|
| F3.1 | line 26, the non-`ApiError` fallback | `login` rejects with a plain `new Error("boom")` | Shows the `auth.genericError` text. |
| F3.2 | line 76, switching **back** to login | Click "Need an account? Register", then "Already have an account? Log in" | The heading returns to "Log in", and a previously shown error is cleared by each switch. |

### F4. `ContextMenu.tsx`

Branches 47, 53 and 59 are not reached. Read section 6 first: `select()`'s `isDisabled` guard (line 47) is unreachable through a disabled `<button>`, and the `ref` guards (lines 53, 59) are defensive. The behaviour (disabled entries do nothing) **is** already tested. Do not add tests here unless F4.1 is cheap.

| # | Scenario | Assertion |
|---|---|---|
| F4.1 *(optional)* | Programmatic click on an entry whose `disabled` getter flips to `true` between render and click | `onSelect` not called, menu stays open. Only worth it if it reaches line 47 without hacking the DOM. |

### F5. `api/client.ts`

File: `tests/api/client.test.ts`.

| # | Source | Scenario | Assertion |
|---|---|---|---|
| F5.1 | line 20, body present | `apiRequest("/x", { method: "POST", body: JSON.stringify({ a: 1 }) })` | `fetch` called with headers containing `Content-Type: application/json`. |
| F5.2 | line 20, no body | `apiRequest("/x")` | `fetch` headers have **no** `Content-Type`. |
| F5.3 | caller headers win | pass `headers: { "Content-Type": "text/plain" }` with a body | The caller's value is sent (it is spread last). |
| F5.4 *(optional)* | line 1, default API URL | `vi.stubEnv("VITE_API_URL", undefined)`, `vi.resetModules()`, dynamic `import("~/api/client")` | URL starts with `http://localhost:3000`. If `stubEnv` rejects `undefined` in the installed Vitest, skip it. |

### F6. `i18n/translate.ts` and `index.tsx`

- `translate.ts` line 24: the uncovered branch is the **non-DEV** side of `import.meta.env.DEV`. The warning itself is already tested. Leave it, or exclude it (section 6).
- `src/index.tsx` is the bootstrap (`render(...)` into `#root`). Exclude it from coverage (Step 0) rather than testing it. `App.test.tsx` already covers `App`.

## 5. Backend gaps

Work from `backend/`. Unit tests live in `backend/tests/unit/` and `vitest.config.ts` only includes `tests/unit/**/*.test.ts`.

### B1. `lib/neo4j.ts` (0%)

New file: `tests/unit/lib/neo4j.test.ts`.

The module keeps a module-level `driver`, so call `vi.resetModules()` in `beforeEach` and import it dynamically inside each test. Mock the two dependencies:

```ts
const driverFactory = vi.fn();
vi.mock("neo4j-driver", () => ({
  default: { driver: (...args: unknown[]) => driverFactory(...args), auth: { basic: vi.fn((u, p) => ({ u, p })) } },
}));
const ensureConstraints = vi.fn();
vi.mock("~/lib/schema", () => ({ ensureConstraints: (...a: unknown[]) => ensureConstraints(...a) }));
```

| # | Scenario | Assertion |
|---|---|---|
| B1.1 | `NEO4J_URI`, `NEO4J_USER` or `NEO4J_PASSWORD` unset (test each of the three) | `getDriver()` throws a message naming the variables; `driverFactory` not called. |
| B1.2 | All set | `driverFactory` called once with the URI and `auth.basic(user, password)`. |
| B1.3 | `getDriver()` twice | Same instance; `driverFactory` called once; `ensureConstraints` called once. |
| B1.4 | `ensureConstraints` rejects | `getDriver()` still returns the driver, `console.error("Failed to ensure Neo4j constraints", error)` is called (spy on `console.error`; wait a microtask). Must not throw or produce an unhandled rejection. |
| B1.5 | `closeDriver()` after `getDriver()` | The driver's `close` is awaited, and the next `getDriver()` builds a new driver (`driverFactory` called twice). |
| B1.6 | `closeDriver()` with no driver | Resolves without error and without calling anything. |

Restore `process.env` in `afterEach` so other test files are unaffected.

### B2. `lib/schema.ts` (0%)

New file: `tests/unit/lib/schema.test.ts`. Reuse `createMockDriver` from `tests/unit/helpers/mockDriver.ts`.

| # | Scenario | Assertion |
|---|---|---|
| B2.1 | `ensureConstraints(driver)` | `run` called four times; the statements contain `user_email_unique`, `user_id_unique`, `todo_id_unique`, `session_token_hash_unique`, each with `IF NOT EXISTS`. |
| B2.2 | A statement rejects | The error propagates **and** the session's `close()` was still called (the `finally`). |
| B2.3 | Success | `close()` called exactly once. |

`createMockDriver` returns a driver whose `session()` always returns the same session object; keep a reference to it (call `driver.session()` in the test) to read `run` and `close`.

### B3. Malformed JSON bodies on four routes

The `await event.request.json().catch(() => null)` callback is never executed in `login`, `register`, `todos/index` (POST) and `todos/[id]` (PATCH). Add one test per route in the matching existing file (`routes/login.test.ts`, `register.test.ts`, `todosIndex.test.ts`, `todoItem.test.ts`).

`createMockEvent` always `JSON.stringify`s the body, so to send invalid JSON build the event by hand or extend the helper:

```ts
// tests/unit/helpers/mockEvent.ts: add an optional `rawBody?: string` option.
if (rawBody !== undefined) {
  init.body = rawBody;
  init.headers = { "Content-Type": "application/json" };
}
```

| # | Route | Body | Expected |
|---|---|---|---|
| B3.1 | `POST /api/auth/login` | `"{not json"` | `400`, `Email and password are required` |
| B3.2 | `POST /api/auth/register` | `"{not json"` | `400`, `A valid email is required` |
| B3.3 | `POST /api/todos` (logged in) | `"{not json"` | `400`, `Title is required`; repository not called |
| B3.4 | `PATCH /api/todos/:id` (logged in) | `"{not json"` | `400`, `completed must be a boolean`; repository not called |
| B3.5 | `login` / `register` | JSON body where `email` or `password` is a number or `null` | `400` (covers the `typeof body?.email === "string"` false side) |

### B4. `routes/api/auth/me.ts`

File: `tests/unit/routes/me.test.ts`.

| # | Scenario | Assertion |
|---|---|---|
| B4.1 | Valid session cookie but `findById` resolves `null` (user deleted elsewhere) | `GET` returns `401` `Unauthorized`; the session cookie is cleared (`getUserIdFromEvent(event)` resolves `null` afterwards, as the DELETE test does). |

### B5. `middleware.ts`

File: `tests/unit/lib/middleware.test.ts` (created in the optimistic change). The non-`OPTIONS` early return is untested.

| # | Scenario | Assertion |
|---|---|---|
| B5.1 | `onRequest` with a `GET` request | Returns `undefined` (request passes through). |
| B5.2 | `onRequest` with `OPTIONS` and **no** `Origin` header | `204`, none of the `Access-Control-*` headers. |
| B5.3 | Allowed origin | Also asserts `Allow-Methods` and `Allow-Headers` (currently only `Max-Age` and `Allow-Origin` are). |

### B6. Repositories

| # | File / source | Scenario | Assertion |
|---|---|---|---|
| B6.1 | `userRepository.ts` `findById` line 71 | `run` returns `{ records: [] }` | Resolves `null`; session closed. |
| B6.2 | `todoRepository.ts` `deleteTodo` line 77, the `?? 0` fallback | `run` returns `{ records: [] }` (no row at all) | Resolves `false`. The existing "returns false" test uses a record with `deletedCount` 0, which is a different branch. |

### B7. `[id].ts` and `index.ts` anonymous functions

These are the `.catch(() => null)` callbacks from B3; no extra tests beyond B3.3 and B3.4.

## 6. Deliberately not covered

| Where | Why | What to do |
|---|---|---|
| `TodoContext.deleteTodo` rollback guard `if (prev.some((item) => item.id === removed.id)) return prev;` (~175) | Defensive. A row can only reappear if the list is refetched, and refetching only happens on a user change, which the `userChangedSince` guard already stops. Two deletes of one id cannot overlap (the second finds `index === -1`). | Leave uncovered, or mark `/* v8 ignore next */`. Do not contort a test to reach it. |
| `ContextMenu.select` `isDisabled` guard (47) and `ref` guards (53, 59) | A disabled entry is a disabled `<button>`, so the click never reaches `select`. The user-visible behaviour is tested. | Leave. |
| `translate.ts` `import.meta.env.DEV` false side (24) | Only differs in a production build. | Leave. |
| `src/index.tsx`, backend `app.tsx`, `entry-client.tsx`, `entry-server.tsx`, `routes/index.tsx` | Framework bootstraps with no logic. | Exclude from coverage (Step 0). |

## 7. Implementation steps and verification

### Step 0: coverage tooling (do this first)

1. Install the provider at the **same version as Vitest** in each package (both are `5.0.2` today; check with `node -p "require('vitest/package.json').version"`):

   ```
   cd frontend && npm install --save-dev @vitest/coverage-v8@<vitest-version>
   cd ../backend && npm install --save-dev @vitest/coverage-v8@<vitest-version>
   ```

   Keep `package-lock.json` changes; the Dockerfiles use them.

2. Add a script to each `package.json`:

   - `frontend`: `"test:coverage": "vitest run --coverage"`
   - `backend`: `"test:coverage": "vitest run tests/unit --coverage"` (the existing `test` script passes `tests/unit` explicitly; keep the same scope)

3. In each `vitest.config.ts` add inside `test`:

   ```ts
   coverage: {
     provider: "v8",
     include: ["src/**/*.{ts,tsx}"],
     exclude: [
       "src/**/*.d.ts",
       "src/index.tsx",            // frontend bootstrap
       "src/env.d.ts",
       // backend only:
       "src/app.tsx",
       "src/entry-client.tsx",
       "src/entry-server.tsx",
       "src/routes/index.tsx",
     ],
     reporter: ["text", "html"],
     reportsDirectory: "coverage",
   },
   ```

   Keep only the excludes that exist in that package. Add `coverage/` to the root `.gitignore`.

4. A backend coverage run printed a `PARSE_ERROR` (pos 48) for an unidentified file while still finishing. Re-run after the excludes above; if it persists, find the file with `npx vitest run tests/unit --coverage --coverage.reporter=text 2>&1 | grep -B5 PARSE_ERROR` and exclude it (likely a `.tsx` entry file or a generated `app.config.timestamp_*.js`).

5. Do **not** add thresholds yet. Add them at the end (Step 4).

**Expected:** `npm run test:coverage` prints the table in section 1 in both packages.

### Step 1: frontend tests

Implement F1, F2, F3, F5 (and F4.1 only if cheap). Run `cd frontend && npm test`. All existing tests must still pass; the new count should be about 117 + 20.

### Step 2: backend tests

Implement B1 to B6 (including the `rawBody` helper option). Run `cd backend && npm test`.

### Step 3: measure

```
cd frontend && npm run test:coverage
cd ../backend && npm run test:coverage
```

Compare with section 8. If a number is short, open `coverage/index.html` and find the file.

### Step 4: lock it in

Add thresholds just under the measured result so regressions fail:

```ts
coverage: {
  // ...
  thresholds: { statements: 95, branches: 85, functions: 95, lines: 95 },
}
```

Pick the numbers from the actual result (about 2 points below), not from this document.

### Step 5: typecheck and the rest of the suite

```
cd frontend && npx tsc --noEmit && npm run build && npm test
cd ../backend && npm test
```

Integration (`npm run test:integration`) and `cd e2e && npm run e2e` are unaffected by this change but should still pass if you have Docker running.

## 8. Targets (acceptance criteria)

| Package | Statements | Branches | Functions |
|---|---|---|---|
| `frontend/` | ≥ 99% | ≥ 92% | 100% |
| `backend/` | ≥ 97% | ≥ 90% | ≥ 95% |

Remaining uncovered branches must each be one of the items in section 6.

- `npm run test:coverage` works in both packages and writes to a git-ignored `coverage/`.
- Thresholds are set and the command exits non-zero when they are not met.
- Every test in sections 4 and 5 exists (apart from the ones marked optional).
- All pre-existing tests still pass; typecheck and build are clean.
- No application source changed, apart from optional `v8 ignore` comments.
- Nothing committed.

## 9. Out of scope (possible follow-ups)

- **Mutation testing** (Stryker). Line coverage says a line ran, not that a test would notice if it were wrong. This is the right next step if confidence in assertion quality matters.
- Running `test:coverage` in CI and publishing the HTML report.
- Integration coverage for the optimistic-delete 404 path against the real API response shape.
- A shared `mockEvent` option for raw bodies is introduced in B3; other tests could adopt it.
