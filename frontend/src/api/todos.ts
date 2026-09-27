import { apiRequest } from "./client";

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export async function listTodos(): Promise<Todo[]> {
  const result = await apiRequest<{ todos: Todo[] }>("/api/todos", { method: "GET" });
  return result.todos;
}

export function createTodo(title: string): Promise<Todo> {
  return apiRequest<Todo>("/api/todos", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export function setCompleted(id: string, completed: boolean): Promise<Todo> {
  return apiRequest<Todo>(`/api/todos/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ completed }),
  });
}

export function deleteTodo(id: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/todos/${id}`, { method: "DELETE" });
}
