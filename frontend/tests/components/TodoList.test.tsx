import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSignal } from "solid-js";
import { fireEvent, screen, waitFor } from "@solidjs/testing-library";
import { renderWithI18n } from "../helpers/renderWithI18n";

const mockedCreateTodo = vi.fn();
const mockedToggleTodo = vi.fn();
const mockedDeleteTodo = vi.fn();
let mockedTodos: Array<{ id: string; title: string; completed: boolean }> = [];
const [mockedLoading, setMockedLoading] = createSignal(false);
let mockedError: string | null = null;
let mockedPendingIds = new Set<string>();

vi.mock("~/context/TodoContext", () => ({
  useTodos: () => ({
    todos: () => mockedTodos,
    loading: mockedLoading,
    error: () => mockedError,
    isPending: (id: string) => mockedPendingIds.has(id),
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
  mockedPendingIds = new Set();
});

describe("TodoList", () => {
  it("shows a loading message while loading", () => {
    setMockedLoading(true);
    renderWithI18n(() => <TodoList />);
    expect(screen.getByText("Loading to-dos…")).toBeInTheDocument();
  });

  it("shows a message when there are no todos", () => {
    renderWithI18n(() => <TodoList />);
    expect(screen.getByText("No to-dos yet.")).toBeInTheDocument();
  });

  it("renders todos from the store", () => {
    mockedTodos = [{ id: "t1", title: "Buy milk", completed: false }];
    renderWithI18n(() => <TodoList />);
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
  });

  it("shows the error alert when the context reports an error", () => {
    mockedError = "Failed to load to-dos.";
    renderWithI18n(() => <TodoList />);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load to-dos.");
  });

  it("labels the new todo input for assistive technology", () => {
    renderWithI18n(() => <TodoList />);
    expect(screen.getByLabelText("New to-do")).toBe(screen.getByPlaceholderText("What needs doing?"));
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

  it("restores the entered title when createTodo fails", async () => {
    mockedCreateTodo.mockResolvedValue(false);
    renderWithI18n(() => <TodoList />);

    await fireEvent.input(screen.getByPlaceholderText("What needs doing?"), {
      target: { value: "Buy milk" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(mockedCreateTodo).toHaveBeenCalledWith("Buy milk");
    await waitFor(() => expect(screen.getByPlaceholderText("What needs doing?")).toHaveValue("Buy milk"));
  });

  it("calls toggleTodo when a todo's checkbox is clicked", async () => {
    mockedTodos = [{ id: "t1", title: "Buy milk", completed: false }];
    renderWithI18n(() => <TodoList />);

    await fireEvent.click(screen.getByRole("checkbox"));

    expect(mockedToggleTodo).toHaveBeenCalledWith("t1", true);
  });

  it("renders only the todos the context reports as pending as inert", () => {
    mockedTodos = [
      { id: "pending-1", title: "Saving", completed: false },
      { id: "t1", title: "Buy milk", completed: false },
    ];
    mockedPendingIds = new Set(["pending-1"]);
    renderWithI18n(() => <TodoList />);

    const [saving, saved] = screen.getAllByRole("listitem");
    expect(saving.querySelector("input")).toBeDisabled();
    expect(saving).toHaveAttribute("aria-busy", "true");
    expect(saved.querySelector("input")).toBeEnabled();
    expect(saved).not.toHaveAttribute("aria-busy", "true");
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

    it("re-enables the input and the button once loading finishes", () => {
      setMockedLoading(true);
      renderWithI18n(() => <TodoList />);

      setMockedLoading(false);

      expect(titleInput()).toBeEnabled();
      expect(addButton()).toBeEnabled();
      expect(form()).toHaveAttribute("aria-busy", "false");
    });

    it("clears the input immediately and stays enabled while a create is in flight", async () => {
      const create = deferred<boolean>();
      mockedCreateTodo.mockReturnValue(create.promise);
      renderWithI18n(() => <TodoList />);

      await fireEvent.input(titleInput(), { target: { value: "Buy milk" } });
      await fireEvent.click(addButton());

      expect(titleInput()).toHaveValue("");
      expect(titleInput()).toBeEnabled();
      expect(addButton()).toBeEnabled();

      create.resolve(true);
      await waitFor(() => expect(titleInput()).toHaveValue(""));
    });

    it("does not show the empty-title message on a second submit while a create is pending", async () => {
      const create = deferred<boolean>();
      mockedCreateTodo.mockReturnValue(create.promise);
      renderWithI18n(() => <TodoList />);

      await fireEvent.input(titleInput(), { target: { value: "Buy milk" } });
      await fireEvent.click(addButton());
      await fireEvent.click(addButton());

      expect(screen.queryByText("Enter a to-do item")).not.toBeInTheDocument();
      expect(mockedCreateTodo).toHaveBeenCalledTimes(1);

      create.resolve(true);
    });

    it("creates again when a second submit has new text while the first is pending", async () => {
      const create = deferred<boolean>();
      mockedCreateTodo.mockReturnValue(create.promise);
      renderWithI18n(() => <TodoList />);

      await fireEvent.input(titleInput(), { target: { value: "Buy milk" } });
      await fireEvent.click(addButton());
      await fireEvent.input(titleInput(), { target: { value: "Walk dog" } });
      await fireEvent.click(addButton());

      expect(mockedCreateTodo).toHaveBeenCalledTimes(2);
      expect(mockedCreateTodo).toHaveBeenLastCalledWith("Walk dog");

      create.resolve(true);
    });

    describe("empty title message", () => {
      const message = () => screen.queryByText("Enter a to-do item");

      afterEach(() => {
        vi.useRealTimers();
      });

      it("keeps the add button clickable and shows a message instead of creating an empty todo", async () => {
        renderWithI18n(() => <TodoList />);

        expect(addButton()).toBeEnabled();
        await fireEvent.click(addButton());

        expect(message()).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("Enter a to-do item");
        expect(mockedCreateTodo).not.toHaveBeenCalled();
      });

      it("shows the message and creates nothing for whitespace-only input", async () => {
        renderWithI18n(() => <TodoList />);

        await fireEvent.input(titleInput(), { target: { value: "   " } });
        await fireEvent.click(addButton());

        expect(message()).toBeInTheDocument();
        expect(mockedCreateTodo).not.toHaveBeenCalled();
      });

      it("shows the message when the form is submitted with Enter on an empty input", async () => {
        renderWithI18n(() => <TodoList />);

        await fireEvent.submit(form());

        expect(message()).toBeInTheDocument();
        expect(mockedCreateTodo).not.toHaveBeenCalled();
      });

      it("links the message to the input while it shows", async () => {
        renderWithI18n(() => <TodoList />);

        await fireEvent.click(addButton());

        expect(titleInput()).toHaveAttribute("aria-invalid", "true");
        expect(titleInput()).toHaveAccessibleDescription("Enter a to-do item");
      });

      it("hides the message as soon as the user types", async () => {
        renderWithI18n(() => <TodoList />);
        await fireEvent.click(addButton());
        expect(message()).toBeInTheDocument();

        await fireEvent.input(titleInput(), { target: { value: "B" } });

        expect(message()).not.toBeInTheDocument();
        expect(titleInput()).toHaveAttribute("aria-invalid", "false");
      });

      it("hides the message after 15 seconds", async () => {
        vi.useFakeTimers();
        renderWithI18n(() => <TodoList />);
        await fireEvent.click(addButton());

        vi.advanceTimersByTime(14_999);
        expect(message()).toBeInTheDocument();

        vi.advanceTimersByTime(1);
        expect(message()).not.toBeInTheDocument();
      });

      it("restarts the 15 seconds when the button is clicked again", async () => {
        vi.useFakeTimers();
        renderWithI18n(() => <TodoList />);
        await fireEvent.click(addButton());

        vi.advanceTimersByTime(10_000);
        await fireEvent.click(addButton());
        vi.advanceTimersByTime(10_000);
        expect(message()).toBeInTheDocument();

        vi.advanceTimersByTime(5_000);
        expect(message()).not.toBeInTheDocument();
      });

      it("hides the message and creates the todo on a valid submit", async () => {
        mockedCreateTodo.mockResolvedValue(true);
        renderWithI18n(() => <TodoList />);
        await fireEvent.click(addButton());
        expect(message()).toBeInTheDocument();

        await fireEvent.input(titleInput(), { target: { value: "Buy milk" } });
        await fireEvent.click(addButton());

        expect(message()).not.toBeInTheDocument();
        expect(mockedCreateTodo).toHaveBeenCalledWith("Buy milk");
      });
    });

    it("puts the title back in the input after a failed create", async () => {
      const create = deferred<boolean>();
      mockedCreateTodo.mockReturnValue(create.promise);
      renderWithI18n(() => <TodoList />);

      await fireEvent.input(titleInput(), { target: { value: "Buy milk" } });
      await fireEvent.click(addButton());
      expect(titleInput()).toHaveValue("");

      create.resolve(false);

      await waitFor(() => expect(titleInput()).toHaveValue("Buy milk"));
    });

    it("does not restore the title after a failed create if the user typed something else", async () => {
      const create = deferred<boolean>();
      mockedCreateTodo.mockReturnValue(create.promise);
      renderWithI18n(() => <TodoList />);

      await fireEvent.input(titleInput(), { target: { value: "Buy milk" } });
      await fireEvent.click(addButton());
      await fireEvent.input(titleInput(), { target: { value: "Walk dog" } });

      create.resolve(false);
      await waitFor(() => expect(mockedCreateTodo).toHaveBeenCalledTimes(1));
      await Promise.resolve();

      expect(titleInput()).toHaveValue("Walk dog");
    });
  });
});
