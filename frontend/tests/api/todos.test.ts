import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/api/client", async () => {
  const actual = await vi.importActual<typeof import("~/api/client")>("~/api/client");
  return { ...actual, apiRequest: vi.fn() };
});

import { apiRequest } from "~/api/client";
import { createTodo, deleteTodo, listTodos, setCompleted } from "~/api/todos";

const mockedApiRequest = apiRequest as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedApiRequest.mockReset();
});

describe("todos api", () => {
  it("listTodos unwraps the todos array", async () => {
    mockedApiRequest.mockResolvedValue({ todos: [{ id: "t1", title: "Buy milk", completed: false }] });
    const todos = await listTodos();
    expect(todos).toEqual([{ id: "t1", title: "Buy milk", completed: false }]);
    expect(mockedApiRequest).toHaveBeenCalledWith("/api/todos", { method: "GET" });
  });

  it("createTodo posts the title", async () => {
    mockedApiRequest.mockResolvedValue({ id: "t1", title: "Buy milk", completed: false });
    await createTodo("Buy milk");
    expect(mockedApiRequest).toHaveBeenCalledWith("/api/todos", {
      method: "POST",
      body: JSON.stringify({ title: "Buy milk" }),
    });
  });

  it("setCompleted patches the completed flag", async () => {
    mockedApiRequest.mockResolvedValue({ id: "t1", title: "Buy milk", completed: true });
    await setCompleted("t1", true);
    expect(mockedApiRequest).toHaveBeenCalledWith("/api/todos/t1", {
      method: "PATCH",
      body: JSON.stringify({ completed: true }),
    });
  });

  it("deleteTodo issues a DELETE", async () => {
    mockedApiRequest.mockResolvedValue({ ok: true });
    await deleteTodo("t1");
    expect(mockedApiRequest).toHaveBeenCalledWith("/api/todos/t1", { method: "DELETE" });
  });
});
