import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { WebDriver } from "selenium-webdriver";
import { config } from "../src/config";
import { createDriver, resetBrowser } from "../src/driver";
import { saveArtifacts } from "../src/helpers/artifacts";
import { t } from "../src/helpers/strings";
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

describe("empty input", () => {
  it("clicking Add with an empty input shows the error and adds nothing", async () => {
    const todos = await signedInTodoPage("empty-click");

    await todos.clickAdd();

    expect(await todos.alertText()).toBe(t("todos.titleRequired"));
    expect(await todos.rowCount()).toBe(0);
  });

  it("pressing Enter on an empty input shows the same error", async () => {
    const todos = await signedInTodoPage("empty-enter");

    await todos.submitWithEnter();

    expect(await todos.alertText()).toBe(t("todos.titleRequired"));
    expect(await todos.rowCount()).toBe(0);
  });

  it("whitespace-only input is treated as empty", async () => {
    const todos = await signedInTodoPage("empty-space");

    await todos.typeTitle("   ");
    await todos.clickAdd();

    expect(await todos.alertText()).toBe(t("todos.titleRequired"));
    expect(await todos.rowCount()).toBe(0);
  });

  it("typing makes the error disappear", async () => {
    const todos = await signedInTodoPage("empty-type");

    await todos.clickAdd();
    expect(await todos.alertText()).toBe(t("todos.titleRequired"));

    await todos.typeTitle("x");
    await todos.waitForAlertGone("error to disappear after typing");
  });

  it.skipIf(config.skipSlow)(
    "the error goes away by itself after 15 seconds",
    async () => {
      const todos = await signedInTodoPage("empty-timer");

      await todos.clickAdd();
      expect(await todos.alertText()).toBe(t("todos.titleRequired"));

      await todos.expectAlertPersistsFor(10_000);
      await todos.waitForAlertGone("error to expire", 10_000);
    },
    60_000,
  );

  it("a valid add clears the error", async () => {
    const todos = await signedInTodoPage("empty-valid");

    await todos.clickAdd();
    expect(await todos.alertText()).toBe(t("todos.titleRequired"));

    await todos.addTodo("Now valid");
    await todos.waitForTitle("Now valid");

    expect(await todos.hasAlert()).toBe(false);
  });
});
