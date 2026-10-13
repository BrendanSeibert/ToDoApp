import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { WebDriver } from "selenium-webdriver";
import { createDriver, resetBrowser } from "../src/driver";
import { saveArtifacts } from "../src/helpers/artifacts";
import { serverMessages } from "../src/helpers/serverMessages";
import { t } from "../src/helpers/strings";
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

/** Registers the given user and waits for the to-do screen. */
async function register(email: string): Promise<void> {
  const auth = new AuthPage(driver);
  await auth.open();
  await auth.register(email, TEST_PASSWORD);
  await new TodoPage(driver).waitUntilReady();
}

describe("account deletion", () => {
  it("shows a confirmation before deleting", async () => {
    const account = new AccountMenu(driver);
    await register(uniqueEmail("del-confirm"));

    await account.startDelete();

    expect(await account.confirmationVisible()).toBe(true);
  });

  it("cancelling keeps the account", async () => {
    const account = new AccountMenu(driver);
    await register(uniqueEmail("del-cancel"));

    await account.startDelete();
    await account.cancelDeletion();

    expect(await account.isVisible()).toBe(true);
    expect(await account.confirmationVisible()).toBe(false);
  });

  it("confirming deletes the account and logs out", async () => {
    const account = new AccountMenu(driver);
    const auth = new AuthPage(driver);
    await register(uniqueEmail("del-confirmed"));

    await account.startDelete();
    await account.confirmDeletion();

    expect(await auth.headingText()).toBe(t("auth.login.heading"));
  });

  it("a deleted account can no longer log in", async () => {
    const account = new AccountMenu(driver);
    const auth = new AuthPage(driver);
    const email = uniqueEmail("del-login");
    await register(email);

    await account.startDelete();
    await account.confirmDeletion();
    await auth.login(email, TEST_PASSWORD);

    expect(await auth.errorText()).toBe(serverMessages.badCredentials);
  });

  it("a deleted user's to-dos are gone for good", async () => {
    const account = new AccountMenu(driver);
    const auth = new AuthPage(driver);
    const todos = new TodoPage(driver);
    const email = uniqueEmail("del-todos");
    await register(email);

    await todos.addTodo("Doomed item");
    await todos.waitForTitle("Doomed item");
    await todos.waitForSaved("Doomed item");

    await account.startDelete();
    await account.confirmDeletion();
    await auth.register(email, TEST_PASSWORD);
    await todos.waitUntilReady();

    expect(await todos.emptyStateVisible()).toBe(true);
    expect(await todos.rowCount()).toBe(0);
  });
});
