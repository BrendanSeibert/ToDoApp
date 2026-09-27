import "../helpers/vinxiHttpMock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken } from "~/lib/auth";
import { createMockEvent } from "../helpers/mockEvent";

vi.mock("~/lib/neo4j", () => ({ getDriver: vi.fn(() => ({})) }));
vi.mock("~/lib/repositories/todoRepository", () => ({ createTodoRepository: vi.fn() }));

import { createTodoRepository } from "~/lib/repositories/todoRepository";
import { GET, POST } from "~/routes/api/todos/index";

process.env.SESSION_SECRET = "unit-test-secret";

const mockedCreateTodoRepository = createTodoRepository as unknown as ReturnType<typeof vi.fn>;
const authCookie = { todo_session: createSessionToken("u1") };

beforeEach(() => {
  process.env.SESSION_SECRET = "unit-test-secret";
  mockedCreateTodoRepository.mockReset();
});

describe("GET /api/todos", () => {
  it("returns 401 when not logged in", async () => {
    mockedCreateTodoRepository.mockReturnValue({ listTodos: vi.fn() });
    const response = await GET(createMockEvent({}));
    expect(response.status).toBe(401);
  });

  it("returns the current user's todos", async () => {
    const listTodos = vi.fn().mockResolvedValue([{ id: "t1", title: "Buy milk", completed: false }]);
    mockedCreateTodoRepository.mockReturnValue({ listTodos });
    const response = await GET(createMockEvent({ cookies: authCookie }));

    expect(response.status).toBe(200);
    expect(listTodos).toHaveBeenCalledWith("u1");
    await expect(response.json()).resolves.toEqual({
      todos: [{ id: "t1", title: "Buy milk", completed: false }],
    });
  });
});

describe("POST /api/todos", () => {
  it("returns 401 when not logged in", async () => {
    mockedCreateTodoRepository.mockReturnValue({ createTodo: vi.fn() });
    const response = await POST(createMockEvent({ method: "POST", body: { title: "Buy milk" } }));
    expect(response.status).toBe(401);
  });

  it("rejects a missing title", async () => {
    mockedCreateTodoRepository.mockReturnValue({ createTodo: vi.fn() });
    const event = createMockEvent({ method: "POST", body: { title: "  " }, cookies: authCookie });
    const response = await POST(event);
    expect(response.status).toBe(400);
  });

  it("creates a todo for the current user", async () => {
    const createTodo = vi.fn().mockResolvedValue({ id: "t1", title: "Buy milk", completed: false });
    mockedCreateTodoRepository.mockReturnValue({ createTodo });
    const event = createMockEvent({ method: "POST", body: { title: "Buy milk" }, cookies: authCookie });
    const response = await POST(event);

    expect(response.status).toBe(201);
    expect(createTodo).toHaveBeenCalledWith("u1", "Buy milk");
    await expect(response.json()).resolves.toEqual({ id: "t1", title: "Buy milk", completed: false });
  });
});
