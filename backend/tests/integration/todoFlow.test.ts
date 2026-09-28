import { beforeAll, describe, expect, it } from "vitest";
import { uniqueEmail, waitForBackend } from "./helpers/backend";
import { TestClient } from "./helpers/client";

const testEmail = uniqueEmail("integration");
const testPassword = "correct-horse-battery-staple";

beforeAll(async () => {
  await waitForBackend();
}, 30000);

describe("end-to-end account and todo lifecycle", () => {
  it("registers, logs in, manages todos, and deletes the account", async () => {
    const client = new TestClient();

    const registerResponse = await client.post("/api/auth/register", {
      email: testEmail,
      password: testPassword,
    });
    expect(registerResponse.status).toBe(201);
    const registered = await registerResponse.json();
    expect(registered.email).toBe(testEmail);

    const meAfterRegister = await client.get("/api/auth/me");
    expect(meAfterRegister.status).toBe(200);

    const logoutResponse = await client.post("/api/auth/logout");
    expect(logoutResponse.status).toBe(200);

    const meAfterLogout = await client.get("/api/auth/me");
    expect(meAfterLogout.status).toBe(401);

    const badLogin = await client.post("/api/auth/login", {
      email: testEmail,
      password: "wrong-password",
    });
    expect(badLogin.status).toBe(401);

    const loginResponse = await client.post("/api/auth/login", {
      email: testEmail,
      password: testPassword,
    });
    expect(loginResponse.status).toBe(200);

    const emptyTodos = await client.get("/api/todos");
    expect(emptyTodos.status).toBe(200);
    expect((await emptyTodos.json()).todos).toEqual([]);

    const createResponse = await client.post("/api/todos", { title: "Buy milk" });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    expect(created.title).toBe("Buy milk");
    expect(created.completed).toBe(false);

    const listAfterCreate = await client.get("/api/todos");
    const todosAfterCreate = (await listAfterCreate.json()).todos;
    expect(todosAfterCreate).toHaveLength(1);
    expect(todosAfterCreate[0].id).toBe(created.id);

    const completeResponse = await client.patch(`/api/todos/${created.id}`, { completed: true });
    expect(completeResponse.status).toBe(200);
    expect((await completeResponse.json()).completed).toBe(true);

    const deleteTodoResponse = await client.delete(`/api/todos/${created.id}`);
    expect(deleteTodoResponse.status).toBe(200);

    const listAfterDelete = await client.get("/api/todos");
    expect((await listAfterDelete.json()).todos).toEqual([]);

    const deleteMissingTodo = await client.delete(`/api/todos/${created.id}`);
    expect(deleteMissingTodo.status).toBe(404);

    const deleteAccountResponse = await client.delete("/api/auth/me");
    expect(deleteAccountResponse.status).toBe(200);

    const meAfterAccountDeletion = await client.get("/api/auth/me");
    expect(meAfterAccountDeletion.status).toBe(401);

    const loginAfterDeletion = await client.post("/api/auth/login", {
      email: testEmail,
      password: testPassword,
    });
    expect(loginAfterDeletion.status).toBe(401);
  });

  it("rejects registering with the same email twice", async () => {
    const email = uniqueEmail("dup");
    const client = new TestClient();

    const first = await client.post("/api/auth/register", { email, password: testPassword });
    expect(first.status).toBe(201);

    const second = await new TestClient().post("/api/auth/register", { email, password: testPassword });
    expect(second.status).toBe(400);

    await client.delete("/api/auth/me");
  });

  it("rejects the loser of a concurrent registration for the same email with a 400, not a 500", async () => {
    const email = uniqueEmail("race");
    const clients = [new TestClient(), new TestClient()];

    // Both pass the "email already taken" pre-check before either finishes hashing and inserting.
    const responses = await Promise.all(
      clients.map((client) => client.post("/api/auth/register", { email, password: testPassword })),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([201, 400]);
    const loser = responses.find((response) => response.status === 400)!;
    expect((await loser.json()).error).toBe("An account with this email already exists");

    const winner = clients[responses.findIndex((response) => response.status === 201)];
    await winner.delete("/api/auth/me");
  });
});
