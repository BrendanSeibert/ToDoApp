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

describe("registration", () => {
  it("registers a new user and lands on the to-do screen", async () => {
    const auth = new AuthPage(driver);
    const todos = new TodoPage(driver);
    const account = new AccountMenu(driver);
    const email = uniqueEmail("register");

    await auth.open();
    await auth.register(email, TEST_PASSWORD);
    await todos.waitUntilReady();

    expect(await todos.navbarTitle()).toBe(t("navbar.todos"));
    expect(await account.shownEmail()).toBe(email);
    expect(await todos.emptyStateVisible()).toBe(true);
  });

  it("shows an error for an email that already exists", async () => {
    const auth = new AuthPage(driver);
    const todos = new TodoPage(driver);
    const account = new AccountMenu(driver);
    const email = uniqueEmail("duplicate");

    await auth.open();
    await auth.register(email, TEST_PASSWORD);
    await todos.waitUntilReady();
    await account.logOut();
    await auth.showLogin();

    await auth.register(email, TEST_PASSWORD);

    expect(await auth.errorText()).toBe(serverMessages.emailTaken);
    expect(await auth.headingText()).toBe(t("auth.register.heading"));
  });

  it("does not register a password shorter than 8 characters", async () => {
    const auth = new AuthPage(driver);

    await auth.open();
    await auth.showRegister();
    await auth.fill(uniqueEmail("short"), "short");
    await auth.submit();

    // Today Chrome's minLength check does not fire (the controlled input resets its "user edited"
    // flag), so the server rejects the password and its message is shown. If that is ever fixed,
    // the browser blocks the submit instead and shows its own tooltip. Both outcomes keep the
    // user on the register screen without an account.
    const blockedByBrowser = await auth.formIsInvalid();
    if (!blockedByBrowser) {
      expect(await auth.errorText()).toBe(serverMessages.passwordTooShort);
    }
    expect(await auth.headingText()).toBe(t("auth.register.heading"));
  });

  it("shows the server's error for an email Chrome accepts but the server rejects", async () => {
    const auth = new AuthPage(driver);

    await auth.open();
    await auth.showRegister();
    await auth.fill("user@localhost", TEST_PASSWORD);
    await auth.submit();

    expect(await auth.errorText()).toBe(serverMessages.invalidEmail);
    expect(await auth.headingText()).toBe(t("auth.register.heading"));
  });

  it("can switch between login and register", async () => {
    const auth = new AuthPage(driver);

    await auth.open();
    expect(await auth.headingText()).toBe(t("auth.login.heading"));

    await auth.showRegister();
    expect(await auth.headingText()).toBe(t("auth.register.heading"));

    await auth.showLogin();
    expect(await auth.headingText()).toBe(t("auth.login.heading"));
  });
});
