import { describe, expect, it } from "vitest";
import { createTodoRepository } from "~/lib/repositories/todoRepository";
import { createMockDriver, fakeInteger, fakeRecord } from "../helpers/mockDriver";

describe("todoRepository", () => {
  it("createTodo returns the created todo", async () => {
    const driver = createMockDriver(() => ({
      records: [
        fakeRecord({
          t: { properties: { id: "t1", title: "Buy milk", completed: false, createdAt: "now" } },
        }),
      ],
    }));
    const repo = createTodoRepository(driver);
    const todo = await repo.createTodo("u1", "Buy milk");
    expect(todo.title).toBe("Buy milk");
    expect(todo.completed).toBe(false);
  });

  it("listTodos returns all todos owned by the user", async () => {
    const driver = createMockDriver(() => ({
      records: [
        fakeRecord({ t: { properties: { id: "t1", title: "A", completed: false } } }),
        fakeRecord({ t: { properties: { id: "t2", title: "B", completed: true } } }),
      ],
    }));
    const repo = createTodoRepository(driver);
    const todos = await repo.listTodos("u1");
    expect(todos).toHaveLength(2);
    expect(todos[1].completed).toBe(true);
  });

  it("listTodos returns an empty array when the user has no todos", async () => {
    const driver = createMockDriver(() => ({ records: [] }));
    const repo = createTodoRepository(driver);
    await expect(repo.listTodos("u1")).resolves.toEqual([]);
  });

  it("setCompleted returns the updated todo when it belongs to the user", async () => {
    const driver = createMockDriver(() => ({
      records: [fakeRecord({ t: { properties: { id: "t1", title: "A", completed: true } } })],
    }));
    const repo = createTodoRepository(driver);
    const todo = await repo.setCompleted("u1", "t1", true);
    expect(todo?.completed).toBe(true);
  });

  it("setCompleted returns null when the todo does not belong to the user", async () => {
    const driver = createMockDriver(() => ({ records: [] }));
    const repo = createTodoRepository(driver);
    await expect(repo.setCompleted("u1", "t1", true)).resolves.toBeNull();
  });

  it("deleteTodo returns true when a todo owned by the user was deleted", async () => {
    const driver = createMockDriver(() => ({
      records: [fakeRecord({ deletedCount: fakeInteger(1) })],
    }));
    const repo = createTodoRepository(driver);
    await expect(repo.deleteTodo("u1", "t1")).resolves.toBe(true);
  });

  it("deleteTodo returns false when the todo does not belong to the user", async () => {
    const driver = createMockDriver(() => ({
      records: [fakeRecord({ deletedCount: fakeInteger(0) })],
    }));
    const repo = createTodoRepository(driver);
    await expect(repo.deleteTodo("u1", "missing")).resolves.toBe(false);
  });
});
