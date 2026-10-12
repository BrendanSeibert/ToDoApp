import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSignal } from "solid-js";
import { fireEvent, screen, waitFor } from "@solidjs/testing-library";
import { renderWithI18n } from "../helpers/renderWithI18n";

const mockedCreateTodo = vi.fn();
const mockedToggleTodo = vi.fn();
const mockedDeleteTodo = vi.fn();
let mockedTodos: Array<{ id: string; title: string; completed: boolean }> = [];
const [mockedLoading, setMockedLoading] = createSignal(false);
let mockedError: string | null = null;

vi.mock("~/context/TodoContext", () => ({
  useTodos: () => ({
    todos: () => mockedTodos,
    loading: mockedLoading,
    error: () => mockedError,
    createTodo: mockedCreateTodo,
    toggleTodo: mockedToggleTodo,
    deleteTodo: mockedDeleteTodo,
  }),
}));

import TodoList from "~/components/TodoList";

beforeEach(() => {
  mockedCreateTodo.mockReset();
  mockedToggleTodo.mockReset();
  mockedDeleteTodo.mockReset();
  mockedTodos = [];
  setMockedLoading(false);
  mockedError = null;
});

describe("TodoList", () => {
  it("shows a loading message while loading", () => {
    setMockedLoading(true);
    renderWithI18n(() => <TodoList />);
    expect(screen.getByText("Loading todos…")).toBeInTheDocument();
  });

  it("shows a message when there are no todos", () => {
    renderWithI18n(() => <TodoList />);
    expect(screen.getByText("No todos yet.")).toBeInTheDocument();
  });

  it("renders todos from the store", () => {
    mockedTodos = [{ id: "t1", title: "Buy milk", completed: false }];
    renderWithI18n(() => <TodoList />);
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
  });

  it("shows the error alert when the context reports an error", () => {
    mockedError = "Failed to load todos.";
    renderWithI18n(() => <TodoList />);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load todos.");
  });

  it("labels the new todo input for assistive technology", () => {
    renderWithI18n(() => <TodoList />);
    expect(screen.getByLabelText("New todo")).toBe(screen.getByPlaceholderText("What needs doing?"));
  });

  it("calls createTodo with the trimmed title and clears the input on success", async () => {
    mockedCreateTodo.mockResolvedValue(true);
    renderWithI18n(() => <TodoList />);

    await fireEvent.input(screen.getByPlaceholderText("What needs doing?"), {
      target: { value: "  Buy milk  " },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(mockedCreateTodo).toHaveBeenCalledWith("Buy milk");
    expect(screen.getByPlaceholderText("What needs doing?")).toHaveValue("");
  });

  it("keeps the entered title when createTodo fails", async () => {
    mockedCreateTodo.mockResolvedValue(false);
    renderWithI18n(() => <TodoList />);

    await fireEvent.input(screen.getByPlaceholderText("What needs doing?"), {
      target: { value: "Buy milk" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(mockedCreateTodo).toHaveBeenCalledWith("Buy milk");
    expect(screen.getByPlaceholderText("What needs doing?")).toHaveValue("Buy milk");
  });

  it("calls toggleTodo when a todo's checkbox is clicked", async () => {
    mockedTodos = [{ id: "t1", title: "Buy milk", completed: false }];
    renderWithI18n(() => <TodoList />);

    await fireEvent.click(screen.getByRole("checkbox"));

    expect(mockedToggleTodo).toHaveBeenCalledWith("t1", true);
  });

  it("calls deleteTodo when delete is clicked", async () => {
    mockedTodos = [{ id: "t1", title: "Buy milk", completed: false }];
    renderWithI18n(() => <TodoList />);

    await fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(mockedDeleteTodo).toHaveBeenCalledWith("t1");
  });

  describe("add form", () => {
    const titleInput = () => screen.getByPlaceholderText("What needs doing?");
    const addButton = () => screen.getByRole("button", { name: "Add" });
    const form = () => addButton().closest("form")!;

    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    }

    it("is disabled while todos are loading", () => {
      setMockedLoading(true);
      renderWithI18n(() => <TodoList />);

      expect(titleInput()).toBeDisabled();
      expect(addButton()).toBeDisabled();
      expect(form()).toHaveAttribute("aria-busy", "true");
    });

    it("ignores a submit while todos are loading", async () => {
      setMockedLoading(true);
      renderWithI18n(() => <TodoList />);

      await fireEvent.input(titleInput(), { target: { value: "Buy milk" } });
      await fireEvent.submit(form());

      expect(mockedCreateTodo).not.toHaveBeenCalled();
    });

    it("is re-enabled once loading finishes, keeping any entered text", async () => {
      setMockedLoading(true);
      renderWithI18n(() => <TodoList />);
      await fireEvent.input(titleInput(), { target: { value: "Buy milk" } });

      setMockedLoading(false);

      expect(titleInput()).toBeEnabled();
      expect(addButton()).toBeEnabled();
      expect(form()).toHaveAttribute("aria-busy", "false");
      expect(titleInput()).toHaveValue("Buy milk");
    });

    it("is disabled while a create is in flight and ignores repeat submits", async () => {
      const create = deferred<boolean>();
      mockedCreateTodo.mockReturnValue(create.promise);
      renderWithI18n(() => <TodoList />);

      await fireEvent.input(titleInput(), { target: { value: "Buy milk" } });
      await fireEvent.click(addButton());

      expect(titleInput()).toBeDisabled();
      expect(addButton()).toBeDisabled();

      await fireEvent.submit(form());
      expect(mockedCreateTodo).toHaveBeenCalledTimes(1);

      create.resolve(true);

      await waitFor(() => expect(titleInput()).toBeEnabled());
      expect(titleInput()).toHaveValue("");
    });

    it("is re-enabled with the title kept after a failed create", async () => {
      const create = deferred<boolean>();
      mockedCreateTodo.mockReturnValue(create.promise);
      renderWithI18n(() => <TodoList />);

      await fireEvent.input(titleInput(), { target: { value: "Buy milk" } });
      await fireEvent.click(addButton());
      expect(addButton()).toBeDisabled();

      create.resolve(false);

      await waitFor(() => expect(addButton()).toBeEnabled());
      expect(titleInput()).toHaveValue("Buy milk");
    });
  });
});
