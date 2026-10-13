import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { WebDriver } from "selenium-webdriver";
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

describe("smoke", () => {
  it("registers a user and adds a to-do", async () => {
    const auth = new AuthPage(driver);
    const todos = new TodoPage(driver);

    await auth.open();
    expect(await driver.getTitle()).toBe(t("app.title"));
    await auth.register(uniqueEmail("smoke"), TEST_PASSWORD);

    await todos.waitUntilReady();
    expect(await todos.navbarTitle()).toBe(t("navbar.todos"));

    await todos.addTodo("Buy milk");
    await todos.waitForTitle("Buy milk");
    expect(await todos.titles()).toEqual(["Buy milk"]);
  });
});
