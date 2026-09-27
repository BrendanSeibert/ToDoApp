import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";

vi.mock("~/api/todos", () => ({
  listTodos: vi.fn(),
  createTodo: vi.fn(),
  setCompleted: vi.fn(),
  deleteTodo: vi.fn(),
}));

import { createTodo, deleteTodo, listTodos, setCompleted } from "~/api/todos";
import TodoList from "~/components/TodoList";

const mockedListTodos = listTodos as unknown as ReturnType<typeof vi.fn>;
const mockedCreateTodo = createTodo as unknown as ReturnType<typeof vi.fn>;
const mockedSetCompleted = setCompleted as unknown as ReturnType<typeof vi.fn>;
const mockedDeleteTodo = deleteTodo as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedListTodos.mockReset();
  mockedCreateTodo.mockReset();
  mockedSetCompleted.mockReset();
  mockedDeleteTodo.mockReset();
});

describe("TodoList", () => {
  it("shows a message when there are no todos", async () => {
    mockedListTodos.mockResolvedValue([]);
    render(() => <TodoList />);
    expect(await screen.findByText("No todos yet.")).toBeInTheDocument();
  });

  it("renders todos loaded on mount", async () => {
    mockedListTodos.mockResolvedValue([{ id: "t1", title: "Buy milk", completed: false }]);
    render(() => <TodoList />);
    expect(await screen.findByText("Buy milk")).toBeInTheDocument();
  });

  it("adds a new todo", async () => {
    mockedListTodos.mockResolvedValue([]);
    mockedCreateTodo.mockResolvedValue({ id: "t1", title: "Buy milk", completed: false });
    render(() => <TodoList />);
    await screen.findByText("No todos yet.");

    await fireEvent.input(screen.getByPlaceholderText("What needs doing?"), {
      target: { value: "Buy milk" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(mockedCreateTodo).toHaveBeenCalledWith("Buy milk");
    expect(await screen.findByText("Buy milk")).toBeInTheDocument();
  });

  it("toggles a todo as completed", async () => {
    mockedListTodos.mockResolvedValue([{ id: "t1", title: "Buy milk", completed: false }]);
    mockedSetCompleted.mockResolvedValue({ id: "t1", title: "Buy milk", completed: true });
    render(() => <TodoList />);
    await screen.findByText("Buy milk");

    await fireEvent.click(screen.getByRole("checkbox"));

    expect(mockedSetCompleted).toHaveBeenCalledWith("t1", true);
    expect(await screen.findByRole("checkbox")).toBeChecked();
  });

  it("deletes a todo", async () => {
    mockedListTodos.mockResolvedValue([{ id: "t1", title: "Buy milk", completed: false }]);
    mockedDeleteTodo.mockResolvedValue({ ok: true });
    render(() => <TodoList />);
    await screen.findByText("Buy milk");

    await fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(mockedDeleteTodo).toHaveBeenCalledWith("t1");
    expect(await screen.findByText("No todos yet.")).toBeInTheDocument();
  });
});
