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

/** Registers a fresh user, waits for the to-do screen, and logs out again. */
async function registerAndLogOut(email: string): Promise<void> {
  const auth = new AuthPage(driver);
  const todos = new TodoPage(driver);
  await auth.open();
  await auth.register(email, TEST_PASSWORD);
  await todos.waitUntilReady();
  await new AccountMenu(driver).logOut();
  await auth.showLogin();
}

describe("login", () => {
  it("logs in with valid credentials", async () => {
    const auth = new AuthPage(driver);
    const todos = new TodoPage(driver);
    const email = uniqueEmail("login");

    await registerAndLogOut(email);
    await auth.login(email, TEST_PASSWORD);
    await todos.waitUntilReady();

    expect(await new AccountMenu(driver).shownEmail()).toBe(email);
  });

  it("rejects a wrong password", async () => {
    const auth = new AuthPage(driver);
    const email = uniqueEmail("wrongpw");

    await registerAndLogOut(email);
    await auth.login(email, "a-different-password");

    expect(await auth.errorText()).toBe(serverMessages.badCredentials);
    expect(await auth.headingText()).toBe(t("auth.login.heading"));
  });

  it("rejects an unknown email", async () => {
    const auth = new AuthPage(driver);

    await auth.open();
    await auth.login(uniqueEmail("unknown"), TEST_PASSWORD);

    expect(await auth.errorText()).toBe(serverMessages.badCredentials);
  });

  it("treats the email as case-insensitive", async () => {
    const auth = new AuthPage(driver);
    const todos = new TodoPage(driver);
    const lower = uniqueEmail("case");
    const mixed = lower.replace("e2e-case", "E2E-Case").replace("@example.com", "@Example.com");

    await auth.open();
    await auth.register(mixed, TEST_PASSWORD);
    await todos.waitUntilReady();
    expect(await new AccountMenu(driver).shownEmail()).toBe(lower);

    await new AccountMenu(driver).logOut();
    await auth.login(lower, TEST_PASSWORD);
    await todos.waitUntilReady();
  });

  it("logs out and stays logged out after a reload", async () => {
    const auth = new AuthPage(driver);

    await registerAndLogOut(uniqueEmail("logout"));
    expect(await auth.headingText()).toBe(t("auth.login.heading"));

    await driver.navigate().refresh();
    expect(await auth.headingText()).toBe(t("auth.login.heading"));
  });

  it("keeps the session across a reload", async () => {
    const auth = new AuthPage(driver);
    const todos = new TodoPage(driver);
    const email = uniqueEmail("session");

    await auth.open();
    await auth.register(email, TEST_PASSWORD);
    await todos.waitUntilReady();

    await driver.navigate().refresh();
    await todos.waitUntilReady();
    expect(await new AccountMenu(driver).shownEmail()).toBe(email);
  });
});
