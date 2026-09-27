import { v4 as uuidv4 } from "uuid";
import type { Driver } from "neo4j-driver";

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export interface TodoRepository {
  createTodo(userId: string, title: string): Promise<Todo>;
  listTodos(userId: string): Promise<Todo[]>;
  setCompleted(userId: string, todoId: string, completed: boolean): Promise<Todo | null>;
  deleteTodo(userId: string, todoId: string): Promise<boolean>;
}

export function createTodoRepository(driver: Driver): TodoRepository {
  return {
    async createTodo(userId, title) {
      const session = driver.session();
      try {
        const id = uuidv4();
        const createdAt = new Date().toISOString();
        const result = await session.run(
          `MATCH (u:User {id: $userId})
           CREATE (t:Todo {id: $id, title: $title, completed: false, createdAt: $createdAt})
           CREATE (u)-[:OWNS]->(t)
           RETURN t`,
          { userId, id, title, createdAt },
        );
        return result.records[0].get("t").properties as Todo;
      } finally {
        await session.close();
      }
    },

    async listTodos(userId) {
      const session = driver.session();
      try {
        const result = await session.run(
          `MATCH (u:User {id: $userId})-[:OWNS]->(t:Todo)
           RETURN t ORDER BY t.createdAt ASC`,
          { userId },
        );
        return result.records.map((record) => record.get("t").properties as Todo);
      } finally {
        await session.close();
      }
    },

    async setCompleted(userId, todoId, completed) {
      const session = driver.session();
      try {
        const result = await session.run(
          `MATCH (u:User {id: $userId})-[:OWNS]->(t:Todo {id: $todoId})
           SET t.completed = $completed
           RETURN t`,
          { userId, todoId, completed },
        );
        if (result.records.length === 0) return null;
        return result.records[0].get("t").properties as Todo;
      } finally {
        await session.close();
      }
    },

    async deleteTodo(userId, todoId) {
      const session = driver.session();
      try {
        const result = await session.run(
          `MATCH (u:User {id: $userId})-[:OWNS]->(t:Todo {id: $todoId})
           DETACH DELETE t
           RETURN count(t) AS deletedCount`,
          { userId, todoId },
        );
        return (result.records[0]?.get("deletedCount")?.toNumber?.() ?? 0) > 0;
      } finally {
        await session.close();
      }
    },
  };
}
