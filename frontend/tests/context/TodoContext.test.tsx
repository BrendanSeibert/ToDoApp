import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSignal, For } from "solid-js";
import { fireEvent, screen, waitFor } from "@solidjs/testing-library";
import { renderWithI18n } from "../helpers/renderWithI18n";

vi.mock("~/api/todos", () => ({
  listTodos: vi.fn(),
  createTodo: vi.fn(),
  setCompleted: vi.fn(),
  deleteTodo: vi.fn(),
}));

interface MockUser {
  id: string;
  email: string;
  createdAt: string;
}

const [mockUser, setMockUser] = createSignal<MockUser | null>(null);
vi.mock("~/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

import { createTodo, deleteTodo, listTodos, setCompleted } from "~/api/todos";
import { ApiError } from "~/api/client";
import { TodoProvider, useTodos } from "~/context/TodoContext";

const mockedListTodos = listTodos as unknown as ReturnType<typeof vi.fn>;
const mockedCreateTodo = createTodo as unknown as ReturnType<typeof vi.fn>;
const mockedSetCompleted = setCompleted as unknown as ReturnType<typeof vi.fn>;
const mockedDeleteTodo = deleteTodo as unknown as ReturnType<typeof vi.fn>;

const loggedInUser: MockUser = { id: "u1", email: "a@example.com", createdAt: "now" };
const otherUser: MockUser = { id: "u2", email: "b@example.com", createdAt: "now" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function renderProvider() {
  return renderWithI18n(() => (
    <TodoProvider>
      <Consumer />
    </TodoProvider>
  ));
}

// A factory, not a shared object: the store adopts fetched objects and reconcile mutates them in place.
const buyMilk = () => ({ id: "t1", title: "Buy milk", completed: false });

// Renders the provider, logs in, and waits for the initial fetch to settle. Pass `todos`
// to set the fetch result; omit it to use whatever listTodos mocks the test already set up.
async function renderLoggedIn(todos?: unknown[]) {
  if (todos) mockedListTodos.mockResolvedValue(todos);
  renderProvider();
  setMockUser(loggedInUser);
  await waitFor(() => expect(mockedListTodos).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
}

function Consumer() {
  const { todos, loading, error, isPending, createTodo, toggleTodo, deleteTodo } = useTodos();
  const pendingId = () => todos().find((todo) => isPending(todo.id))?.id ?? "none";

  return (
    <div>
      <p data-testid="loading">{String(loading())}</p>
      <p data-testid="error">{error() ?? "none"}</p>
      <ul data-testid="todos">
        <For each={todos()}>{(todo) => <li>{`${todo.id}:${todo.title}:${todo.completed}:${isPending(todo.id)}`}</li>}</For>
      </ul>
      <p data-testid="pending-id">{pendingId()}</p>
      <button type="button" onClick={() => createTodo("New todo")}>
        create
      </button>
      <button type="button" onClick={() => toggleTodo(pendingId(), true)}>
        toggle pending
      </button>
      <button type="button" onClick={() => deleteTodo(pendingId())}>
        delete pending
      </button>
      <button type="button" onClick={() => toggleTodo("t1", true)}>
        toggle
      </button>
      <button type="button" onClick={() => deleteTodo("t1")}>
        delete
      </button>
    </div>
  );
}

beforeEach(() => {
  mockedListTodos.mockReset();
  mockedCreateTodo.mockReset();
  mockedSetCompleted.mockReset();
  mockedDeleteTodo.mockReset();
  setMockUser(null);
});

describe("TodoProvider", () => {
  it("does not fetch todos when there is no logged-in user", () => {
    renderWithI18n(() => (
      <TodoProvider>
        <Consumer />
      </TodoProvider>
    ));

    expect(mockedListTodos).not.toHaveBeenCalled();
  });

  it("fetches the user's todos when they log in", async () => {
    mockedListTodos.mockResolvedValue([{ id: "t1", title: "Buy milk", completed: false }]);
    renderWithI18n(() => (
      <TodoProvider>
        <Consumer />
      </TodoProvider>
    ));

    setMockUser(loggedInUser);

    expect(await screen.findByText("t1:Buy milk:false:false")).toBeInTheDocument();
    expect(mockedListTodos).toHaveBeenCalledTimes(1);
  });

  it("resets the store when the user logs out", async () => {
    mockedListTodos.mockResolvedValue([{ id: "t1", title: "Buy milk", completed: false }]);
    renderWithI18n(() => (
      <TodoProvider>
        <Consumer />
      </TodoProvider>
    ));
    setMockUser(loggedInUser);
    await screen.findByText("t1:Buy milk:false:false");

    setMockUser(null);

    expect(screen.queryByText("t1:Buy milk:false:false")).not.toBeInTheDocument();
  });

  it("sets an error message when the initial fetch fails", async () => {
    mockedListTodos.mockRejectedValue(new Error("boom"));
    renderWithI18n(() => (
      <TodoProvider>
        <Consumer />
      </TodoProvider>
    ));

    setMockUser(loggedInUser);

    expect(await screen.findByText("Failed to load to-dos.")).toBeInTheDocument();
  });

  it("shows the new todo as pending at once, then swaps in the server's todo", async () => {
    const create = deferred<unknown>();
    mockedCreateTodo.mockReturnValue(create.promise);
    await renderLoggedIn([]);

    await fireEvent.click(screen.getByRole("button", { name: "create" }));
    expect(screen.getByText(/^pending-\d+:New todo:false:true$/)).toBeInTheDocument();

    create.resolve({ id: "t2", title: "New todo", completed: false });

    expect(await screen.findByText("t2:New todo:false:false")).toBeInTheDocument();
    expect(screen.queryByText(/pending-/)).not.toBeInTheDocument();
  });

  it("removes the pending todo and reports an error when the create fails", async () => {
    const create = deferred<unknown>();
    mockedCreateTodo.mockReturnValue(create.promise);
    await renderLoggedIn([]);

    await fireEvent.click(screen.getByRole("button", { name: "create" }));
    expect(screen.getByText(/New todo/)).toBeInTheDocument();

    create.reject(new Error("boom"));

    expect(await screen.findByText("Failed to create to-do.")).toBeInTheDocument();
    expect(screen.queryByText(/New todo/)).not.toBeInTheDocument();
  });

  it("resolves two creates in flight independently and keeps their order", async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    mockedCreateTodo.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await renderLoggedIn([]);

    await fireEvent.click(screen.getByRole("button", { name: "create" }));
    await fireEvent.click(screen.getByRole("button", { name: "create" }));
    expect(screen.getAllByText(/^pending-\d+:New todo:false:true$/)).toHaveLength(2);

    // Resolve out of order: the rows keep their positions.
    second.resolve({ id: "t3", title: "Second", completed: false });
    await screen.findByText("t3:Second:false:false");
    first.resolve({ id: "t2", title: "First", completed: false });
    await screen.findByText("t2:First:false:false");

    const rows = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(rows).toEqual(["t2:First:false:false", "t3:Second:false:false"]);
  });

  it("ignores toggling or deleting a pending todo", async () => {
    const create = deferred<unknown>();
    mockedCreateTodo.mockReturnValue(create.promise);
    await renderLoggedIn([]);
    await fireEvent.click(screen.getByRole("button", { name: "create" }));

    await fireEvent.click(screen.getByRole("button", { name: "toggle pending" }));
    await fireEvent.click(screen.getByRole("button", { name: "delete pending" }));

    expect(mockedSetCompleted).not.toHaveBeenCalled();
    expect(mockedDeleteTodo).not.toHaveBeenCalled();
    expect(screen.getByText(/^pending-\d+:New todo:false:true$/)).toBeInTheDocument();

    create.resolve({ id: "t2", title: "New todo", completed: false });
    await screen.findByText("t2:New todo:false:false");
  });

  it("optimistically toggles a todo then rolls back if the backend call fails", async () => {
    const update = deferred<unknown>();
    mockedSetCompleted.mockReturnValue(update.promise);
    await renderLoggedIn([buyMilk()]);

    await fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByText("t1:Buy milk:true:false")).toBeInTheDocument();

    update.reject(new Error("boom"));

    expect(await screen.findByText("Failed to update to-do.")).toBeInTheDocument();
    expect(screen.getByText("t1:Buy milk:false:false")).toBeInTheDocument();
  });

  it("keeps a todo toggled when the backend call succeeds", async () => {
    const update = deferred<unknown>();
    mockedSetCompleted.mockReturnValue(update.promise);
    await renderLoggedIn([buyMilk()]);

    await fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByText("t1:Buy milk:true:false")).toBeInTheDocument();

    update.resolve({ ...buyMilk(), completed: true });
    await flushPromises();

    expect(screen.getByText("t1:Buy milk:true:false")).toBeInTheDocument();
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("removes the todo at once and keeps it removed when the backend call succeeds", async () => {
    const remove = deferred<unknown>();
    mockedDeleteTodo.mockReturnValue(remove.promise);
    await renderLoggedIn([buyMilk()]);

    await fireEvent.click(screen.getByRole("button", { name: "delete" }));
    expect(screen.queryByText(/t1:Buy milk/)).not.toBeInTheDocument();

    remove.resolve({ ok: true });
    await flushPromises();

    expect(screen.queryByText(/t1:Buy milk/)).not.toBeInTheDocument();
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("restores the todo when the delete backend call fails", async () => {
    const remove = deferred<unknown>();
    mockedDeleteTodo.mockReturnValue(remove.promise);
    await renderLoggedIn([buyMilk()]);

    await fireEvent.click(screen.getByRole("button", { name: "delete" }));
    expect(screen.queryByText(/t1:Buy milk/)).not.toBeInTheDocument();

    remove.reject(new Error("boom"));

    expect(await screen.findByText("Failed to delete to-do.")).toBeInTheDocument();
    expect(screen.getByText("t1:Buy milk:false:false")).toBeInTheDocument();
  });

  it("restores a failed delete at the original position", async () => {
    const remove = deferred<unknown>();
    mockedDeleteTodo.mockReturnValue(remove.promise);
    await renderLoggedIn([
      { id: "a", title: "One", completed: false },
      { id: "t1", title: "Buy milk", completed: false },
      { id: "c", title: "Three", completed: false },
    ]);

    await fireEvent.click(screen.getByRole("button", { name: "delete" }));
    remove.reject(new Error("boom"));
    await screen.findByText("Failed to delete to-do.");

    const rows = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(rows).toEqual(["a:One:false:false", "t1:Buy milk:false:false", "c:Three:false:false"]);
  });

  it("treats a 404 on delete as success and leaves the todo removed", async () => {
    mockedDeleteTodo.mockRejectedValue(new ApiError(404, "Not found"));
    await renderLoggedIn([buyMilk()]);

    await fireEvent.click(screen.getByRole("button", { name: "delete" }));
    await flushPromises();

    expect(screen.queryByText(/t1:Buy milk/)).not.toBeInTheDocument();
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("does not roll back or report a toggle that fails after the user has changed", async () => {
    const update = deferred<unknown>();
    mockedSetCompleted.mockReturnValue(update.promise);
    // Shares t1's id so an unguarded rollback would visibly flip B's todo.
    const otherUsersTodo = { id: "t1", title: "B's todo", completed: true };
    mockedListTodos.mockResolvedValueOnce([buyMilk()]).mockResolvedValueOnce([otherUsersTodo]);
    await renderLoggedIn();

    await fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    setMockUser(otherUser);
    await screen.findByText("t1:B's todo:true:false");

    update.reject(new Error("boom"));
    await flushPromises();

    expect(screen.getByText("t1:B's todo:true:false")).toBeInTheDocument();
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("does not apply a delete that succeeds after the user has changed", async () => {
    const remove = deferred<unknown>();
    mockedDeleteTodo.mockReturnValue(remove.promise);
    // Shares t1's id so an unguarded removal would visibly drop B's todo.
    const otherUsersTodo = { id: "t1", title: "B's todo", completed: false };
    mockedListTodos.mockResolvedValueOnce([buyMilk()]).mockResolvedValueOnce([otherUsersTodo]);
    await renderLoggedIn();

    await fireEvent.click(screen.getByRole("button", { name: "delete" }));
    setMockUser(otherUser);
    await screen.findByText("t1:B's todo:false:false");

    remove.resolve({ ok: true });
    await flushPromises();

    expect(screen.getByText("t1:B's todo:false:false")).toBeInTheDocument();
  });

  it("does not report a delete failure after the user has changed", async () => {
    const remove = deferred<unknown>();
    mockedDeleteTodo.mockReturnValue(remove.promise);
    mockedListTodos.mockResolvedValueOnce([buyMilk()]).mockResolvedValueOnce([]);
    await renderLoggedIn();

    await fireEvent.click(screen.getByRole("button", { name: "delete" }));
    setMockUser(otherUser);
    remove.reject(new Error("boom"));
    await flushPromises();

    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("reports loading while the fetch is in flight", async () => {
    const fetch = deferred<unknown[]>();
    mockedListTodos.mockReturnValue(fetch.promise);
    renderProvider();

    setMockUser(loggedInUser);
    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    fetch.resolve([]);
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
  });

  it("ignores a stale fetch for a previous user that resolves after the next user's fetch", async () => {
    const fetchA = deferred<unknown[]>();
    const fetchB = deferred<unknown[]>();
    mockedListTodos.mockReturnValueOnce(fetchA.promise).mockReturnValueOnce(fetchB.promise);
    renderProvider();

    setMockUser(loggedInUser);
    setMockUser(null);
    setMockUser(otherUser);

    fetchB.resolve([{ id: "b1", title: "B's todo", completed: false }]);
    expect(await screen.findByText("b1:B's todo:false:false")).toBeInTheDocument();

    fetchA.resolve([{ id: "a1", title: "A's todo", completed: false }]);
    await flushPromises();

    expect(screen.queryByText(/A's todo/)).not.toBeInTheDocument();
    expect(screen.getByText("b1:B's todo:false:false")).toBeInTheDocument();
  });

  it("ignores a stale fetch when switching directly to another user", async () => {
    const fetchA = deferred<unknown[]>();
    const fetchB = deferred<unknown[]>();
    mockedListTodos.mockReturnValueOnce(fetchA.promise).mockReturnValueOnce(fetchB.promise);
    renderProvider();

    setMockUser(loggedInUser);
    setMockUser(otherUser);

    fetchB.resolve([{ id: "b1", title: "B's todo", completed: false }]);
    await screen.findByText("b1:B's todo:false:false");
    fetchA.resolve([{ id: "a1", title: "A's todo", completed: false }]);
    await flushPromises();

    expect(screen.queryByText(/A's todo/)).not.toBeInTheDocument();
  });

  it("clears a fetch error when the user logs out", async () => {
    mockedListTodos.mockRejectedValue(new Error("boom"));
    renderProvider();
    setMockUser(loggedInUser);
    await screen.findByText("Failed to load to-dos.");

    setMockUser(null);

    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("none"));
  });

  it("clears an action error when the user logs out", async () => {
    mockedListTodos.mockResolvedValue([]);
    mockedCreateTodo.mockRejectedValue(new Error("boom"));
    renderProvider();
    setMockUser(loggedInUser);
    await fireEvent.click(screen.getByRole("button", { name: "create" }));
    await screen.findByText("Failed to create to-do.");

    setMockUser(null);

    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("none"));
  });

  it("surfaces the server's message for an ApiError", async () => {
    mockedListTodos.mockRejectedValue(new ApiError(503, "Database unavailable"));
    renderProvider();

    setMockUser(loggedInUser);

    expect(await screen.findByText("Database unavailable")).toBeInTheDocument();
  });

  it("drops a created todo that resolves after the user has changed", async () => {
    const create = deferred<unknown>();
    mockedListTodos.mockResolvedValue([]);
    mockedCreateTodo.mockReturnValue(create.promise);
    renderProvider();
    setMockUser(loggedInUser);
    await flushPromises();

    await fireEvent.click(screen.getByRole("button", { name: "create" }));
    setMockUser(otherUser);
    create.resolve({ id: "t2", title: "New todo", completed: false });
    await flushPromises();

    expect(screen.queryByText(/New todo/)).not.toBeInTheDocument();
  });
});
