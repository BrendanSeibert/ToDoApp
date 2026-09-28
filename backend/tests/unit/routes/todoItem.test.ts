import "../helpers/vinxiHttpMock";
import { createStoredSession, sessionStore } from "../helpers/sessionStoreMock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEvent } from "../helpers/mockEvent";

vi.mock("~/lib/neo4j", () => ({ getDriver: vi.fn(() => ({})) }));
vi.mock("~/lib/repositories/todoRepository", () => ({ createTodoRepository: vi.fn() }));

import { createTodoRepository } from "~/lib/repositories/todoRepository";
import { DELETE, PATCH } from "~/routes/api/todos/[id]";


const mockedCreateTodoRepository = createTodoRepository as unknown as ReturnType<typeof vi.fn>;
let authCookie: Record<string, string>;

beforeEach(() => {
  process.env.SESSION_SECRET = "unit-test-secret";
  sessionStore.clear();
  authCookie = createStoredSession("u1");
  mockedCreateTodoRepository.mockReset();
});

describe("PATCH /api/todos/:id", () => {
  it("returns 401 when not logged in", async () => {
    mockedCreateTodoRepository.mockReturnValue({ setCompleted: vi.fn() });
    const event = createMockEvent({ method: "PATCH", body: { completed: true }, params: { id: "t1" } });
    const response = await PATCH(event);
    expect(response.status).toBe(401);
  });

  it("rejects a non-boolean completed value", async () => {
    mockedCreateTodoRepository.mockReturnValue({ setCompleted: vi.fn() });
    const event = createMockEvent({
      method: "PATCH",
      body: { completed: "yes" },
      params: { id: "t1" },
      cookies: authCookie,
    });
    const response = await PATCH(event);
    expect(response.status).toBe(400);
  });

  it("returns 404 when the todo does not belong to the user", async () => {
    mockedCreateTodoRepository.mockReturnValue({ setCompleted: vi.fn().mockResolvedValue(null) });
    const event = createMockEvent({
      method: "PATCH",
      body: { completed: true },
      params: { id: "missing" },
      cookies: authCookie,
    });
    const response = await PATCH(event);
    expect(response.status).toBe(404);
  });

  it("marks a todo as completed", async () => {
    const setCompleted = vi.fn().mockResolvedValue({ id: "t1", title: "Buy milk", completed: true });
    mockedCreateTodoRepository.mockReturnValue({ setCompleted });
    const event = createMockEvent({
      method: "PATCH",
      body: { completed: true },
      params: { id: "t1" },
      cookies: authCookie,
    });
    const response = await PATCH(event);

    expect(response.status).toBe(200);
    expect(setCompleted).toHaveBeenCalledWith("u1", "t1", true);
    await expect(response.json()).resolves.toEqual({ id: "t1", title: "Buy milk", completed: true });
  });
});

describe("DELETE /api/todos/:id", () => {
  it("returns 401 when not logged in", async () => {
    mockedCreateTodoRepository.mockReturnValue({ deleteTodo: vi.fn() });
    const event = createMockEvent({ method: "DELETE", params: { id: "t1" } });
    const response = await DELETE(event);
    expect(response.status).toBe(401);
  });

  it("returns 404 when the todo does not belong to the user", async () => {
    mockedCreateTodoRepository.mockReturnValue({ deleteTodo: vi.fn().mockResolvedValue(false) });
    const event = createMockEvent({ method: "DELETE", params: { id: "missing" }, cookies: authCookie });
    const response = await DELETE(event);
    expect(response.status).toBe(404);
  });

  it("deletes the todo", async () => {
    const deleteTodo = vi.fn().mockResolvedValue(true);
    mockedCreateTodoRepository.mockReturnValue({ deleteTodo });
    const event = createMockEvent({ method: "DELETE", params: { id: "t1" }, cookies: authCookie });
    const response = await DELETE(event);

    expect(response.status).toBe(200);
    expect(deleteTodo).toHaveBeenCalledWith("u1", "t1");
  });
});
