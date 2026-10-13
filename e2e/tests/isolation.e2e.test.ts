import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { WebDriver } from "selenium-webdriver";
import { createDriver, resetBrowser } from "../src/driver";
import { saveArtifacts } from "../src/helpers/artifacts";
import { TEST_PASSWORD, uniqueEmail } from "../src/helpers/users";
import { AccountMenu } from "../src/pages/AccountMenu";
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

describe("isolation", () => {
  it("one user never sees another user's to-dos", async () => {
    const auth = new AuthPage(driver);
    const todos = new TodoPage(driver);
    const account = new AccountMenu(driver);
    const emailA = uniqueEmail("iso-a");
    const emailB = uniqueEmail("iso-b");

    await auth.open();
    await auth.register(emailA, TEST_PASSWORD);
    await todos.waitUntilReady();
    await todos.addTodo("Private A");
    await todos.waitForTitle("Private A");
    await todos.waitForSaved("Private A");
    await account.logOut();

    await auth.register(emailB, TEST_PASSWORD);
    await todos.waitUntilReady();
    expect(await todos.rowCount()).toBe(0);
    await todos.addTodo("Private B");
    await todos.waitForTitle("Private B");
    await todos.waitForSaved("Private B");
    await account.logOut();

    await auth.login(emailA, TEST_PASSWORD);
    await todos.waitUntilReady();
    expect(await todos.titles()).toEqual(["Private A"]);
  });
});
