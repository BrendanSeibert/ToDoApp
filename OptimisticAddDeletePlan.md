# Optimistic Add / Delete — Implementation Plan

Make adding and deleting a to-do feel instant by updating the list **before** the server replies, rolling back if the request fails. Toggling a to-do is already optimistic and is the pattern to follow.

This document is written for a developer or another Claude instance picking up the work cold. It is self-contained: it describes the current behaviour, the target behaviour, every file to change, the test changes, and how to verify.

---

## 1. Why

Adding or deleting a to-do takes roughly half a second to show up. In `frontend/src/context/TodoContext.tsx`, `createTodo` and `deleteTodo` `await` the API call and only then change the list, so nothing moves on screen until the full round trip finishes. `toggleTodo` already updates first and rolls back on failure, which is why toggling feels instant.

This plan hides that latency. It also removes one avoidable piece of it, the CORS preflight that every POST/PATCH/DELETE currently pays, by caching the preflight (Step 6). It does **not** remove the two sequential database queries per request (see "Out of scope").

This change also alters what the Selenium end-to-end suite has to do: pending rows are inert, so the e2e page objects and some tests must change in the same piece of work (Step 7). See `SeleniumEnd2EndTestingPlan.md` section 3.5 items 7 and 13.

## 2. Current behaviour (read these first)

| File | What matters |
|---|---|
| `frontend/src/context/TodoContext.tsx` | Resource + `createDeepSignal` store (reconciled by `id`). `createTodo`/`deleteTodo` await the API, then `mutate`. `toggleTodo` is optimistic. `userChangedSince(ownerId)` guards against a response landing after logout or a user switch. An effect clears the store when the user becomes `null`. |
| `frontend/src/components/TodoList.tsx` | `submitting` signal; `formDisabled = loading() \|\| submitting()` disables the input and the add button while a create is in flight. `handleCreate` clears the input only after `createTodo` resolves `true`. Also owns the "Enter a to-do item" message and its 15 s timer. |
| `frontend/src/components/TodoItem.tsx` / `.scss` | Row with a hidden native checkbox plus an icon, and a delete icon button. Colours live in the `.d-todo-item` block, sourced from `src/styles/_palette.scss`. |
| `frontend/src/api/todos.ts` | `Todo { id, title, completed, createdAt }`. `createTodo(title)` returns the server's todo (with the real id). |
| `frontend/tests/context/TodoContext.test.tsx` | Context tests (see section 6 for the ones that change). |
| `frontend/tests/components/TodoList.test.tsx` | Mocks `~/context/TodoContext` with `useTodos: () => ({...})`. |
| `backend/src/middleware.ts` | Answers every `OPTIONS` preflight with 204 and the CORS headers, but sends no `Access-Control-Max-Age`, so the browser repeats the preflight before each POST/PATCH/DELETE. |
| `e2e/src/pages/TodoPage.ts`, `e2e/tests/todos.e2e.test.ts` | Selenium page object and tests. They currently assume a new row is immediately clickable; that stops being true (Step 7). |

## 3. Target behaviour

- **Add:** the new row appears in the list the moment Add is pressed, and the input clears immediately. If the request fails, the row is removed, the error block shows the message, and the typed title is put back into the input (only if the user has not typed something new since).
- **Delete:** the row disappears immediately. If the request fails, it is re-inserted at its original position and the error block shows the message.
- **Pending rows are inert:** a row that is still waiting for its real id cannot be toggled or deleted. It looks muted and is marked busy for assistive technology.
- **No in-flight lockout for adds:** the input stays enabled while a create is in flight, so several to-dos can be added in quick succession. Only the initial list load disables the form.
- **A double click on Add must not show the empty-title error.** The first click clears the input; the second click must not report "Enter a to-do item" while a create is pending.
- **Unchanged:** the toggle behaviour, the 15 s empty-title message, loading state, and all user/identity guards.

## 4. Design decisions

1. **Temporary ids.** A new row gets id `pending-<n>` from a module-level counter (deterministic in tests; no dependency on `crypto.randomUUID`). It is replaced in place by the server's todo on success.
2. **Pending state lives in the context, not on `Todo`.** A signal holds a `Set` of pending ids, exposed as `isPending(id)`. The API type stays clean.
3. **Snapshot before removing.** On delete, copy the item (`{ ...item }`) and record its index *before* mutating, because the store item is a reconciled proxy.
4. **Rollback is defensive.** Re-insert at `Math.min(index, next.length)` and only if no row with that id exists.
5. **404 on delete counts as success.** The item is already gone on the server; restoring it would be wrong.
6. **Every post-`await` step keeps the `userChangedSince` guard** and does nothing if the user changed (the store has already been cleared by the existing effect).
7. **All user-facing text goes through `t()`** and all colours come from the palette via a `.d-<component>` variable. Do not add hex values outside `_palette.scss`.

### Known trade-offs (accepted, not bugs to fix in this change)

These follow from the design above. They are written down so a reviewer does not rediscover them.

8. **The row remounts when the temporary id is swapped.** The store reconciles by `id`, so `pending-<n>` becoming the server id is a different item, not an update of the same one. The `<li>` is destroyed and recreated: keyboard focus on that row is lost and any CSS transition restarts. If this proves annoying, give `Todo` rows a stable client-side key and have `For` use it. Not needed for the first version.
9. **One shared error slot.** `actionError` is a single value. A successful delete or toggle calls `setActionError(null)`, which can wipe the message of a create that failed moments earlier. Toggling already behaves this way. With several operations in flight it is a little more likely. A per-operation error list would fix it and is out of scope.
10. **Empty-submit feedback is suppressed while a create is in flight.** The guard `pendingCreates() === 0` exists so a double click does not nag. The side effect is that a user who adds "A" and immediately presses Add on the now-empty input gets no "Enter a to-do item" message until the create resolves. Accepted.
11. **No ordering guarantee between concurrent creates.** The list is ordered by `createdAt` on the server (`todoRepository.ts`). Two POSTs in flight at once can commit in either order, so the order seen locally (append order) can differ from the order after a reload. The unit test "two creates in flight end up in order" only proves local order. The e2e suite checks the reloaded order (Step 7).

## 5. Implementation steps

Work from `frontend/`.

### Step 1 — Context (`src/context/TodoContext.tsx`)

1. Add pending-id state and a temp-id counter:

   ```ts
   let nextPendingId = 0;
   // inside TodoProvider
   const [pendingIds, setPendingIds] = createSignal<ReadonlySet<string>>(new Set());
   const isPending = (id: string) => pendingIds().has(id);
   const setPending = (id: string, pending: boolean) =>
     setPendingIds((prev) => {
       const next = new Set(prev);
       if (pending) next.add(id);
       else next.delete(id);
       return next;
     });
   ```

2. Add `isPending: (id: string) => boolean` to `TodoContextValue` and to the `value` object.

3. In the existing "user became null" effect, also reset pending state: `setPendingIds(new Set())`.

4. Rewrite `createTodo`:

   ```ts
   async function createTodo(title: string): Promise<boolean> {
     const ownerId = user()?.id;
     const tempId = `pending-${++nextPendingId}`;
     const placeholder: Todo = { id: tempId, title, completed: false, createdAt: new Date().toISOString() };

     mutate((prev) => [...prev, placeholder]);
     setPending(tempId, true);
     setActionError(null);

     try {
       const todo = await apiCreateTodo(title);
       if (userChangedSince(ownerId)) return false;
       mutate((prev) => prev.map((item) => (item.id === tempId ? todo : item)));
       setPending(tempId, false);
       return true;
     } catch (err) {
       if (userChangedSince(ownerId)) return false;
       mutate((prev) => prev.filter((item) => item.id !== tempId));
       setPending(tempId, false);
       setActionError(errorMessage(err, t("errors.createTodo")));
       return false;
     }
   }
   ```

5. Rewrite `deleteTodo`:

   ```ts
   async function deleteTodo(id: string): Promise<boolean> {
     if (isPending(id)) return false;
     const ownerId = user()?.id;
     const index = todos().findIndex((item) => item.id === id);
     if (index === -1) return false;
     const removed = { ...todos()[index] };

     mutate((prev) => prev.filter((item) => item.id !== id));

     try {
       await apiDeleteTodo(id);
       if (userChangedSince(ownerId)) return false;
       setActionError(null);
       return true;
     } catch (err) {
       if (userChangedSince(ownerId)) return false;
       if (err instanceof ApiError && err.status === 404) {
         setActionError(null);
         return true;
       }
       mutate((prev) => {
         if (prev.some((item) => item.id === removed.id)) return prev;
         const next = [...prev];
         next.splice(Math.min(index, next.length), 0, removed);
         return next;
       });
       setActionError(errorMessage(err, t("errors.deleteTodo")));
       return false;
     }
   }
   ```

6. At the top of `toggleTodo`, add `if (isPending(id)) return false;`.

### Step 2 — Form (`src/components/TodoList.tsx`)

1. Replace the `submitting` boolean with a counter of in-flight creates, and stop it disabling the form:

   ```ts
   const [pendingCreates, setPendingCreates] = createSignal(0);
   const formDisabled = () => loading();
   ```

2. Pull `isPending` out of `useTodos()`.

3. Rewrite `handleCreate`:

   ```ts
   async function handleCreate(event: SubmitEvent) {
     event.preventDefault();
     if (formDisabled()) return;
     const title = newTitle().trim();
     if (!title) {
       // The first click of a double click has already cleared the input; do not nag.
       if (pendingCreates() === 0) showTitleRequired();
       return;
     }

     hideTitleRequired();
     setNewTitle("");
     setPendingCreates((count) => count + 1);
     try {
       const created = await createTodo(title);
       // Put the text back only if the user has not started typing something else.
       if (!created && newTitle() === "") setNewTitle(title);
     } finally {
       setPendingCreates((count) => count - 1);
     }
   }
   ```

4. Pass `pending={isPending(todo.id)}` to `<TodoItem>`.

5. Update the comment above `formDisabled`: it now only covers the initial fetch; creates intentionally do not lock the form.

### Step 3 — Row (`src/components/TodoItem.tsx`, `TodoItem.scss`)

1. Add `pending?: boolean` to `TodoItemProps`.
2. On the `<li>`: `classList={{ pending: props.pending }}` and `aria-busy={props.pending}`.
3. On the checkbox `<input>` and the delete `<button>`: `disabled={props.pending}`.
4. In `TodoItem.scss`:
   - Add `--text-color-todo-item-pending: #{p.$grey-600};` to the `.d-todo-item` block, and apply it with `.todo-item.pending { color: var(--text-color-todo-item-pending); }`.
   - The delete button's hover/focus rule currently colours it red unconditionally. Scope it with `:not(:disabled)` and give `.delete-button:disabled` and the disabled checkbox label `cursor: default` (not `not-allowed`; the red "no" cursor was deliberately removed elsewhere).

### Step 4 — Tests

See section 6.

### Step 5 — Verify

See section 7.

### Step 6 — Cache the CORS preflight (`backend/src/middleware.ts`)

**Why:** every non-GET request currently triggers a separate `OPTIONS` round trip first. Optimistic UI hides the wait for a request; this removes a whole round trip from it. It is one line and does not change behaviour.

1. Inside the existing `if (corsHeaders) { ... }` block add:

   ```ts
   // Let the browser reuse the preflight result. Chrome caps this at 7200 s; Firefox at 86400 s.
   headers.set("Access-Control-Max-Age", "7200");
   ```

   Keep it inside the block so a request from a disallowed origin still gets a bare 204 with no CORS headers.

2. Add a unit test next to the other backend tests (there is none for the middleware today), for example `backend/tests/unit/lib/middleware.test.ts`: an `OPTIONS` request from the allowed origin gets `Access-Control-Max-Age: 7200`, and one from another origin gets none of the `Access-Control-*` headers.

3. Check the `Dockerfile` target `runtime` still builds; no other backend file changes.

### Step 7 — Update the Selenium suite (`e2e/`)

Do this in the same change as Steps 1 to 3. With only those steps applied, the existing e2e tests become flaky (a freshly added row is disabled until the server replies, and Selenium's click on a disabled control does nothing and raises no error). Full detail and rationale: `SeleniumEnd2EndTestingPlan.md` section 3.5 items 7 and 13, Step 8 (`TodoPage`), and section 6 (`optimistic.e2e.test.ts`).

1. **`e2e/src/pages/TodoPage.ts`**
   - Add `waitUntilSettled(title)`: waits until a row with that title exists, has no `pending` class, and its `aria-busy` is not `"true"`.
   - Call it at the start of `toggle()` and `delete()` (before the click), so they never click a pending row.
   - Add `addAndSettle(title)`: `addTodo` + `waitForTitle` + `waitUntilSettled` + `waitForSaved`.
   - Add small read helpers used by the new tests: `isPending(title)`, `isRowControlsEnabled(title)`.
2. **`e2e/src/helpers/network.ts`** (new): thin wrappers over `driver.setNetworkConditions(...)`: `goOffline(driver)`, `addLatency(driver, ms)`, `restoreNetwork(driver)`. Always restore in `afterEach`, otherwise one failing test poisons the next.
3. **Existing tests** (`todos.e2e.test.ts`): use `addAndSettle` where a row is toggled or deleted straight after being added; in "shows the empty state after deleting the last to-do" also call `waitForSavedGone` so a rolled-back delete cannot pass.
4. **New `e2e/tests/optimistic.e2e.test.ts`** with the scenarios listed in `SeleniumEnd2EndTestingPlan.md` section 6.
5. Run `cd e2e && npm run e2e` three times in a row; all three must pass.

## 6. Test changes

Use the existing helpers: `renderWithI18n`, the `deferred()` helper pattern already used in `TodoList.test.tsx` and `TodoContext.test.tsx`, and Vitest fake timers where timers matter.

### `tests/context/TodoContext.test.tsx`

Extend the `Consumer` to render `isPending(todo.id)` next to each row (e.g. `${id}:${title}:${completed}:${pending}`) so tests can assert it.

| Existing test | Change |
|---|---|
| "adds the todo to the store only after the backend call succeeds" | Rewrite: the row (with a `pending-…` id) is present *before* the API promise resolves and is marked pending; after resolving, the row has the server id and is no longer pending. |
| "does not add the todo when the backend call fails" | Rewrite: row appears, then is removed after rejection; error message shown. |
| "removes the todo from the store only after the backend call succeeds" | Rewrite: row is gone *before* the API resolves; stays gone after. |
| "keeps the todo when the delete backend call fails" | Rewrite: row disappears, then is restored **at its original index** after rejection; error shown. |
| "does not apply a delete that succeeds after the user has changed" | Re-check; assertions should still hold (no touching the new user's list). |
| "does not report a delete failure after the user has changed" | Same. |
| "drops a created todo that resolves after the user has changed" | Same; also assert pending state is cleared on user change. |

New tests:

- Deleting a middle item and failing restores it at the same index (use 3 items).
- A `404` on delete leaves the item removed and shows no error.
- Toggling or deleting a pending row is a no-op and makes no API call.
- Two creates in flight resolve independently and end up in order.

### `tests/components/TodoList.test.tsx`

- Add `isPending: () => false` (or a controllable mock) to the mocked `useTodos()` return value.
- Replace "is disabled while a create is in flight and ignores repeat submits" with:
  - the input clears immediately and stays enabled while `createTodo` is pending;
  - a second submit with the (now empty) input does **not** show the "Enter a to-do item" message while a create is pending;
  - a second submit with new text calls `createTodo` again.
- Replace "is re-enabled with the title kept after a failed create" with: after a failed create the input holds the original title again.
- New: after a failed create, the title is **not** restored if the user has typed something else in the meantime.
- Keep the loading tests as they are (the form is still disabled during the initial load).

### `tests/components/TodoItem.test.tsx`

- New: with `pending` set, the checkbox and the delete button are disabled, the row has `aria-busy="true"`, and clicking does not call `onToggle`/`onDelete`.

## 7. Verification

From `frontend/`:

```
npx tsc --noEmit
npm run build
npm test
```

All three must pass.

From `backend/`: `npm test` (includes the new middleware test from Step 6).

From `e2e/`: `npm run e2e`, three times in a row. All 33 existing tests plus the new `optimistic.e2e.test.ts` scenarios must pass without retries (Step 7).

Manual checks in the browser (`npm run dev`, or the compose stack):

1. Add a to-do: it appears at once and the input clears.
2. Delete a to-do: it disappears at once.
3. Add several to-dos rapidly: one row each, in order, each swapped to its real id.
4. Stop the backend, then add and delete: the add row vanishes and the title returns to the input; the deleted row reappears at its original position; the error block shows the message in both cases.
5. Double-click Add with text in the input: one to-do is created and no "Enter a to-do item" message appears.
6. Press Add with an empty input (no create pending): the message still appears and still disappears after 15 s or on typing.
7. A pending row cannot be toggled or deleted.
8. In the browser's network tab, after the first POST the following POST/PATCH/DELETE requests to the API send **no** `OPTIONS` request within two hours (Step 6).

## 8. Acceptance criteria

- Add and delete update the list before the network call resolves.
- Failures roll back cleanly and surface through the existing error block, with no stale pending state.
- No behaviour regression for toggle, loading, user switching, or the empty-title message.
- Typecheck, build and the full test suite pass.
- No new hex values outside `_palette.scss`; no hard-coded user-facing strings.
- Preflight responses carry `Access-Control-Max-Age` for allowed origins only, and have a unit test.
- The Selenium suite is updated (Step 7) and passes three runs in a row, including the new optimistic scenarios: row visible while the request is outstanding, inert while pending, rollback on add, rollback on delete at the original position.

## 9. Conventions for this repo

- Do **not** commit unless asked; the owner reviews changes first.
- Commit messages, when requested, follow the repo style (`dev:` / `ref:` prefix, lowercase).
- Strings: add keys to `src/i18n/en.json` and read them with `t()`.
- Styling: colours via a `--…` variable in the component's `.d-<name>` block, valued from `src/styles/_palette.scss`; shape tokens and mixins live in `src/styles/_tokens.scss`.

## 10. Out of scope (possible follow-ups)

These reduce the real latency rather than hiding it, and are intentionally not part of this change:

- Serve the API same-origin through nginx, which removes the preflight entirely and removes the cross-site cookie constraints (this one is a deployment change; `Access-Control-Max-Age` in Step 6 already captures most of the benefit).
- A per-operation error list instead of one shared `actionError` (trade-off 9).
- A stable client-side row key so the row is not remounted when the server id arrives (trade-off 8).
- Merge the session lookup and the to-do query into a single Cypher query per request (currently two sequential Neo4j round trips).
- Measure against a production build (`docker compose up --build`) rather than the dev server before judging remaining latency.
