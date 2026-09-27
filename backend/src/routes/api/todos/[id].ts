import type { APIEvent } from "@solidjs/start/server";
import { getDriver } from "~/lib/neo4j";
import { createTodoRepository } from "~/lib/repositories/todoRepository";
import { requireUserId } from "~/lib/session";
import { errorResponse, json, ValidationError } from "~/lib/http";

export async function PATCH(event: APIEvent): Promise<Response> {
  try {
    const userId = requireUserId(event);
    const todoId = event.params.id;
    const body = await event.request.json().catch(() => null);

    if (typeof body?.completed !== "boolean") {
      throw new ValidationError("completed must be a boolean");
    }

    const todoRepository = createTodoRepository(getDriver());
    const todo = await todoRepository.setCompleted(userId, todoId, body.completed);

    if (!todo) {
      return json({ error: "Todo not found" }, 404, event);
    }

    return json(todo, 200, event);
  } catch (error) {
    return errorResponse(error, event);
  }
}

export async function DELETE(event: APIEvent): Promise<Response> {
  try {
    const userId = requireUserId(event);
    const todoId = event.params.id;

    const todoRepository = createTodoRepository(getDriver());
    const deleted = await todoRepository.deleteTodo(userId, todoId);

    if (!deleted) {
      return json({ error: "Todo not found" }, 404, event);
    }

    return json({ ok: true }, 200, event);
  } catch (error) {
    return errorResponse(error, event);
  }
}
