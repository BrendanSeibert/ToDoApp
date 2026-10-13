import {
  createContext,
  createEffect,
  createResource,
  createSignal,
  on,
  useContext,
  type Accessor,
  type JSX,
  type Signal,
} from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";
import {
  createTodo as apiCreateTodo,
  deleteTodo as apiDeleteTodo,
  listTodos,
  setCompleted,
  type Todo,
} from "~/api/todos";
import { ApiError } from "~/api/client";
import { useAuth } from "./AuthContext";
import { useI18n } from "./I18nContext";

interface TodoContextValue {
  todos: Accessor<Todo[]>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
  isPending: (id: string) => boolean;
  createTodo: (title: string) => Promise<boolean>;
  toggleTodo: (id: string, completed: boolean) => Promise<boolean>;
  deleteTodo: (id: string) => Promise<boolean>;
}

const TodoContext = createContext<TodoContextValue>();

// Source of temporary ids for optimistically added rows.
let nextPendingId = 0;

interface TodoProviderProps {
  children: JSX.Element;
}

// Store-backed storage for createResource: updates are reconciled by `id`, so
// changing one todo only updates that todo's subscribers instead of re-rendering the list.
function createDeepSignal<T>(value: T): Signal<T> {
  const [store, setStore] = createStore({ value });
  return [
    () => store.value,
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(unwrap(store.value)) : next;
      setStore("value", reconcile(resolved));
      return store.value;
    },
  ] as Signal<T>;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function TodoProvider(props: TodoProviderProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [actionError, setActionError] = createSignal<string | null>(null);
  // Ids of rows added optimistically that are still waiting for the server's todo.
  const [pendingIds, setPendingIds] = createSignal<ReadonlySet<string>>(new Set<string>());
  const isPending = (id: string) => pendingIds().has(id);
  const setPending = (id: string, pending: boolean) =>
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });

  // Keyed by user id: a new user triggers a refetch, and responses from a superseded
  // request are discarded, so a slow fetch for a previous user can't land in the store.
  const [todosResource, { mutate }] = createResource(() => user()?.id, () => listTodos(), {
    initialValue: [],
    storage: createDeepSignal,
  });

  // With no user the fetcher doesn't run and the resource keeps its last value, so clear it.
  createEffect(
    on(
      user,
      (currentUser) => {
        if (!currentUser) {
          mutate([]);
          setPendingIds(new Set<string>());
          setActionError(null);
        }
      },
      { defer: true },
    ),
  );

  // Reading an errored resource throws, so guard it.
  const todos = () => (todosResource.state === "errored" ? [] : todosResource());
  const loading = () => todosResource.loading;
  const error = () =>
    actionError() ?? (todosResource.error ? errorMessage(todosResource.error, t("errors.loadTodos")) : null);

  // True if the user changed while a request was in flight, so its result must be dropped.
  const userChangedSince = (ownerId: string | undefined) => user()?.id !== ownerId;

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

  async function toggleTodo(id: string, completed: boolean): Promise<boolean> {
    if (isPending(id)) return false;
    const ownerId = user()?.id;
    const previous = todos().find((todo) => todo.id === id)?.completed;
    const setTodoCompleted = (value: boolean) =>
      mutate((prev) => prev.map((todo) => (todo.id === id ? { ...todo, completed: value } : todo)));

    setTodoCompleted(completed);

    try {
      await setCompleted(id, completed);
      if (!userChangedSince(ownerId)) setActionError(null);
      return true;
    } catch (err) {
      if (userChangedSince(ownerId)) return false;
      if (previous !== undefined) setTodoCompleted(previous);
      setActionError(errorMessage(err, t("errors.updateTodo")));
      return false;
    }
  }

  async function deleteTodo(id: string): Promise<boolean> {
    if (isPending(id)) return false;
    const ownerId = user()?.id;
    const index = todos().findIndex((item) => item.id === id);
    if (index === -1) return false;
    // Copy before removing: the store item is a reconciled proxy.
    const removed = { ...todos()[index] };

    mutate((prev) => prev.filter((item) => item.id !== id));

    try {
      await apiDeleteTodo(id);
      if (userChangedSince(ownerId)) return false;
      setActionError(null);
      return true;
    } catch (err) {
      if (userChangedSince(ownerId)) return false;
      // Already gone on the server, so restoring it would be wrong.
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

  const value: TodoContextValue = {
    todos,
    loading,
    error,
    isPending,
    createTodo,
    toggleTodo,
    deleteTodo,
  };

  return <TodoContext.Provider value={value}>{props.children}</TodoContext.Provider>;
}

export function useTodos(): TodoContextValue {
  const context = useContext(TodoContext);
  if (!context) {
    throw new Error("useTodos must be used within a TodoProvider");
  }
  return context;
}
