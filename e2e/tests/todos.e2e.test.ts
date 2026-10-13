import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { By, type WebDriver } from "selenium-webdriver";
import { createDriver, resetBrowser } from "../src/driver";
import { saveArtifacts } from "../src/helpers/artifacts";
import { TEST_PASSWORD, uniqueEmail } from "../src/helpers/users";
import { AuthPage } from "../src/pages/AuthPage";
import { TodoPage } from "../src/pages/TodoPage";

let driver: WebDriver;

beforeAll(async () => {
  driver = await createDriver();
});
afterAll(async () => {
  await driver?.quit();
});
beforeEach(async () => {
  await resetBrowser(driver);
});
afterEach(async ({ task }) => {
  if (task.result?.state !== "fail") return;
  try {
    await saveArtifacts(driver, task.name);
  } catch (error) {
    // A crashed browser must not replace the test's real failure with an artefact error.
    console.warn(`Could not save failure artefacts: ${String(error)}`);
  }
});

/** Registers a fresh user and returns the to-do page, ready for input. */
async function signedInTodoPage(label: string): Promise<TodoPage> {
  const auth = new AuthPage(driver);
  const todos = new TodoPage(driver);
  await auth.open();
  await auth.register(uniqueEmail(label), TEST_PASSWORD);
  await todos.waitUntilReady();
  return todos;
}

describe("to-dos", () => {
  it("adds a to-do with the Add button", async () => {
    const todos = await signedInTodoPage("add");

    await todos.addTodo("Buy milk");
    await todos.waitForTitle("Buy milk");

    expect(await todos.titles()).toEqual(["Buy milk"]);
    await todos.waitUntilReady();
    expect(await todos.inputValue()).toBe("");
  });

  it("adds a to-do by pressing Enter", async () => {
    const todos = await signedInTodoPage("enter");

    await todos.submitWithEnter("Enter title");
    await todos.waitForTitle("Enter title");

    expect(await todos.titles()).toEqual(["Enter title"]);
  });

  it("lists to-dos in the order they were added", async () => {
    const todos = await signedInTodoPage("order");

    for (const title of ["First", "Second", "Third"]) {
      await todos.addTodo(title);
      await todos.waitForTitle(title);
    }

    expect(await todos.titles()).toEqual(["First", "Second", "Third"]);
  });

  it("keeps to-dos after a reload", async () => {
    const todos = await signedInTodoPage("reload");

    await todos.addTodo("Persistent item");
    await todos.waitForTitle("Persistent item");
    await todos.waitForSaved("Persistent item");

    await driver.navigate().refresh();
    await todos.waitUntilReady();

    expect(await todos.titles()).toEqual(["Persistent item"]);
  });

  it("marks a to-do completed and keeps it so", async () => {
    const todos = await signedInTodoPage("toggle");

    await todos.addTodo("Toggle me");
    await todos.waitForTitle("Toggle me");
    await todos.waitForSaved("Toggle me");

    await todos.toggle("Toggle me");
    expect(await todos.isCompleted("Toggle me")).toBe(true);

    await driver.navigate().refresh();
    await todos.waitUntilReady();
    expect(await todos.isCompleted("Toggle me")).toBe(true);

    await todos.toggle("Toggle me");
    expect(await todos.isCompleted("Toggle me")).toBe(false);

    await driver.navigate().refresh();
    await todos.waitUntilReady();
    expect(await todos.isCompleted("Toggle me")).toBe(false);
  });

  it("deletes a to-do and keeps it deleted", async () => {
    const todos = await signedInTodoPage("delete");

    await todos.addTodo("Keep me");
    await todos.waitForTitle("Keep me");
    await todos.addTodo("Remove me");
    await todos.waitForTitle("Remove me");

    await todos.delete("Remove me");
    await todos.waitForTitleGone("Remove me");
    await todos.waitForSavedGone("Remove me");
    expect(await todos.titles()).toEqual(["Keep me"]);

    await driver.navigate().refresh();
    await todos.waitUntilReady();
    expect(await todos.titles()).toEqual(["Keep me"]);
  });

  it("shows the empty state after deleting the last to-do", async () => {
    const todos = await signedInTodoPage("last");

    await todos.addTodo("Only item");
    await todos.waitForTitle("Only item");
    await todos.delete("Only item");
    await todos.waitForTitleGone("Only item");

    expect(await todos.emptyStateVisible()).toBe(true);
  });

  it("trims whitespace around the title", async () => {
    const todos = await signedInTodoPage("trim");

    await todos.typeTitle("  Padded title  ");
    await todos.clickAdd();
    await todos.waitForTitle("Padded title");

    expect(await todos.titles()).toEqual(["Padded title"]);
  });

  it("shows HTML characters as plain text", async () => {
    const todos = await signedInTodoPage("html");

    await todos.addTodo("<b>bold</b>");
    await todos.waitForTitle("<b>bold</b>");

    expect(await todos.titles()).toEqual(["<b>bold</b>"]);
    // Rendered as text, so no <b> element exists inside the list.
    expect(await driver.findElements(By.css(".todo-list li b"))).toHaveLength(0);
  });
});
