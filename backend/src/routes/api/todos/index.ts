import type { APIEvent } from "@solidjs/start/server";
import { getDriver } from "~/lib/neo4j";
import { createTodoRepository } from "~/lib/repositories/todoRepository";
import { requireUserId } from "~/lib/session";
import { errorResponse, json, ValidationError } from "~/lib/http";

export async function GET(event: APIEvent): Promise<Response> {
  try {
    const userId = await requireUserId(event);
    const todoRepository = createTodoRepository(getDriver());
    const todos = await todoRepository.listTodos(userId);
    return json({ todos }, 200, event);
  } catch (error) {
    return errorResponse(error, event);
  }
}

export async function POST(event: APIEvent): Promise<Response> {
  try {
    const userId = await requireUserId(event);
    const body = await event.request.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";

    if (!title) {
      throw new ValidationError("Title is required");
    }

    const todoRepository = createTodoRepository(getDriver());
    const todo = await todoRepository.createTodo(userId, title);
    return json(todo, 201, event);
  } catch (error) {
    return errorResponse(error, event);
  }
}
