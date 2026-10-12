# Optimistic Add / Delete — Implementation Plan

Make adding and deleting a to-do feel instant by updating the list **before** the server replies, rolling back if the request fails. Toggling a to-do is already optimistic and is the pattern to follow.

This document is written for a developer or another Claude instance picking up the work cold. It is self-contained: it describes the current behaviour, the target behaviour, every file to change, the test changes, and how to verify.

---

## 1. Why

Adding or deleting a to-do takes roughly half a second to show up. In `frontend/src/context/TodoContext.tsx`, `createTodo` and `deleteTodo` `await` the API call and only then change the list, so nothing moves on screen until the full round trip finishes. `toggleTodo` already updates first and rolls back on failure, which is why toggling feels instant.

This plan hides that latency. It does **not** remove it (CORS preflight and two sequential database queries per request are still there; see "Out of scope").

## 2. Current behaviour (read these first)

| File | What matters |
|---|---|
| `frontend/src/context/TodoContext.tsx` | Resource + `createDeepSignal` store (reconciled by `id`). `createTodo`/`deleteTodo` await the API, then `mutate`. `toggleTodo` is optimistic. `userChangedSince(ownerId)` guards against a response landing after logout or a user switch. An effect clears the store when the user becomes `null`. |
| `frontend/src/components/TodoList.tsx` | `submitting` signal; `formDisabled = loading() \|\| submitting()` disables the input and the add button while a create is in flight. `handleCreate` clears the input only after `createTodo` resolves `true`. Also owns the "Enter a to-do item" message and its 15 s timer. |
| `frontend/src/components/TodoItem.tsx` / `.scss` | Row with a hidden native checkbox plus an icon, and a delete icon button. Colours live in the `.d-todo-item` block, sourced from `src/styles/_palette.scss`. |
| `frontend/src/api/todos.ts` | `Todo { id, title, completed, createdAt }`. `createTodo(title)` returns the server's todo (with the real id). |
| `frontend/tests/context/TodoContext.test.tsx` | Context tests (see section 6 for the ones that change). |
| `frontend/tests/components/TodoList.test.tsx` | Mocks `~/context/TodoContext` with `useTodos: () => ({...})`. |

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

Manual checks in the browser (`npm run dev`, or the compose stack):

1. Add a to-do: it appears at once and the input clears.
2. Delete a to-do: it disappears at once.
3. Add several to-dos rapidly: one row each, in order, each swapped to its real id.
4. Stop the backend, then add and delete: the add row vanishes and the title returns to the input; the deleted row reappears at its original position; the error block shows the message in both cases.
5. Double-click Add with text in the input: one to-do is created and no "Enter a to-do item" message appears.
6. Press Add with an empty input (no create pending): the message still appears and still disappears after 15 s or on typing.
7. A pending row cannot be toggled or deleted.

## 8. Acceptance criteria

- Add and delete update the list before the network call resolves.
- Failures roll back cleanly and surface through the existing error block, with no stale pending state.
- No behaviour regression for toggle, loading, user switching, or the empty-title message.
- Typecheck, build and the full test suite pass.
- No new hex values outside `_palette.scss`; no hard-coded user-facing strings.

## 9. Conventions for this repo

- Do **not** commit unless asked; the owner reviews changes first.
- Commit messages, when requested, follow the repo style (`dev:` / `ref:` prefix, lowercase).
- Strings: add keys to `src/i18n/en.json` and read them with `t()`.
- Styling: colours via a `--…` variable in the component's `.d-<name>` block, valued from `src/styles/_palette.scss`; shape tokens and mixins live in `src/styles/_tokens.scss`.

## 10. Out of scope (possible follow-ups)

These reduce the real latency rather than hiding it, and are intentionally not part of this change:

- Add `Access-Control-Max-Age` to the `OPTIONS` response in `backend/src/middleware.ts`, or serve the API same-origin through nginx, to avoid a preflight on every action.
- Merge the session lookup and the to-do query into a single Cypher query per request (currently two sequential Neo4j round trips).
- Measure against a production build (`docker compose up --build`) rather than the dev server before judging remaining latency.
