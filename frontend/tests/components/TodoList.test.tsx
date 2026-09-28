import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";

const mockedCreateTodo = vi.fn();
const mockedToggleTodo = vi.fn();
const mockedDeleteTodo = vi.fn();
let mockedTodos: Array<{ id: string; title: string; completed: boolean }> = [];
let mockedLoading = false;
let mockedError: string | null = null;

vi.mock("~/context/TodoContext", () => ({
  useTodos: () => ({
    todos: () => mockedTodos,
    loading: () => mockedLoading,
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
  mockedLoading = false;
  mockedError = null;
});

describe("TodoList", () => {
  it("shows a loading message while loading", () => {
    mockedLoading = true;
    render(() => <TodoList />);
    expect(screen.getByText("Loading todos…")).toBeInTheDocument();
  });

  it("shows a message when there are no todos", () => {
    render(() => <TodoList />);
    expect(screen.getByText("No todos yet.")).toBeInTheDocument();
  });

  it("renders todos from the store", () => {
    mockedTodos = [{ id: "t1", title: "Buy milk", completed: false }];
    render(() => <TodoList />);
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
  });

  it("shows the error alert when the context reports an error", () => {
    mockedError = "Failed to load todos.";
    render(() => <TodoList />);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load todos.");
  });

  it("calls createTodo with the trimmed title and clears the input on success", async () => {
    mockedCreateTodo.mockResolvedValue(true);
    render(() => <TodoList />);

    await fireEvent.input(screen.getByPlaceholderText("What needs doing?"), {
      target: { value: "  Buy milk  " },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(mockedCreateTodo).toHaveBeenCalledWith("Buy milk");
    expect(screen.getByPlaceholderText("What needs doing?")).toHaveValue("");
  });

  it("keeps the entered title when createTodo fails", async () => {
    mockedCreateTodo.mockResolvedValue(false);
    render(() => <TodoList />);

    await fireEvent.input(screen.getByPlaceholderText("What needs doing?"), {
      target: { value: "Buy milk" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(mockedCreateTodo).toHaveBeenCalledWith("Buy milk");
    expect(screen.getByPlaceholderText("What needs doing?")).toHaveValue("Buy milk");
  });

  it("calls toggleTodo when a todo's checkbox is clicked", async () => {
    mockedTodos = [{ id: "t1", title: "Buy milk", completed: false }];
    render(() => <TodoList />);

    await fireEvent.click(screen.getByRole("checkbox"));

    expect(mockedToggleTodo).toHaveBeenCalledWith("t1", true);
  });

  it("calls deleteTodo when delete is clicked", async () => {
    mockedTodos = [{ id: "t1", title: "Buy milk", completed: false }];
    render(() => <TodoList />);

    await fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(mockedDeleteTodo).toHaveBeenCalledWith("t1");
  });
});
