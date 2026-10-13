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

  it("deleteTodo returns false when the query returns no row at all", async () => {
    const driver = createMockDriver(() => ({ records: [] }));
    const repo = createTodoRepository(driver);
    await expect(repo.deleteTodo("u1", "missing")).resolves.toBe(false);
  });

  describe("scoping to the owner", () => {
    function capturing(records: unknown[]) {
      const calls: Array<{ query: string; params: Record<string, unknown> }> = [];
      const driver = createMockDriver((query, params) => {
        calls.push({ query, params: params as Record<string, unknown> });
        return { records };
      });
      return { driver, calls };
    }
    const todoRecord = fakeRecord({ t: { properties: { id: "t1", title: "A", completed: false } } });

    it("createTodo attaches the todo to the given user", async () => {
      const { driver, calls } = capturing([todoRecord]);
      await createTodoRepository(driver).createTodo("u1", "Buy milk");

      expect(calls[0].query).toMatch(/MATCH \(u:User \{id: \$userId\}\)[\s\S]*\(u\)-\[:OWNS\]->\(t\)/);
      expect(calls[0].params).toMatchObject({ userId: "u1", title: "Buy milk" });
    });

    it("listTodos only matches todos the user owns", async () => {
      const { driver, calls } = capturing([]);
      await createTodoRepository(driver).listTodos("u1");

      expect(calls[0].query).toMatch(/\(u:User \{id: \$userId\}\)-\[:OWNS\]->\(t:Todo\)/);
      expect(calls[0].params).toEqual({ userId: "u1" });
    });

    it("setCompleted only matches a todo the user owns", async () => {
      const { driver, calls } = capturing([todoRecord]);
      await createTodoRepository(driver).setCompleted("u1", "t1", true);

      expect(calls[0].query).toMatch(/\(u:User \{id: \$userId\}\)-\[:OWNS\]->\(t:Todo \{id: \$todoId\}\)/);
      expect(calls[0].params).toEqual({ userId: "u1", todoId: "t1", completed: true });
    });

    it("deleteTodo only matches a todo the user owns", async () => {
      const { driver, calls } = capturing([fakeRecord({ deletedCount: fakeInteger(1) })]);
      await createTodoRepository(driver).deleteTodo("u1", "t1");

      expect(calls[0].query).toMatch(/\(u:User \{id: \$userId\}\)-\[:OWNS\]->\(t:Todo \{id: \$todoId\}\)/);
      expect(calls[0].params).toEqual({ userId: "u1", todoId: "t1" });
    });
  });

  it("closes the session when a query fails", async () => {
    const driver = createMockDriver(() => {
      throw new Error("db down");
    });
    const repo = createTodoRepository(driver);

    await expect(repo.listTodos("u1")).rejects.toThrow("db down");
    expect(driver.session().close).toHaveBeenCalledTimes(1);
  });
});
