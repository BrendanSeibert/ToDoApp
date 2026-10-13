import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { WebDriver } from "selenium-webdriver";
import { createDriver, resetBrowser } from "../src/driver";
import { saveArtifacts } from "../src/helpers/artifacts";
import { addLatency, goOffline, restoreNetwork } from "../src/helpers/network";
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
  // Restore first, so a failed test cannot leave the next one offline and artefacts can be saved.
  try {
    await restoreNetwork(driver);
  } catch (error) {
    console.warn(`Could not restore the network: ${String(error)}`);
  }
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

describe("optimistic add and delete", () => {
  it("a new to-do appears before the server replies", async () => {
    const todos = await signedInTodoPage("opt-add");

    await addLatency(driver, 2_000);
    await todos.addTodo("Slow add");
    await todos.waitForTitle("Slow add");

    expect(await todos.isPending("Slow add")).toBe(true);
    expect(await todos.inputValue()).toBe("");

    await restoreNetwork(driver);
    await todos.waitUntilSettled("Slow add");
    await todos.waitForSaved("Slow add");

    await driver.navigate().refresh();
    await todos.waitUntilReady();
    expect(await todos.titles()).toEqual(["Slow add"]);
  });

  it("a pending row cannot be toggled or deleted", async () => {
    const todos = await signedInTodoPage("opt-inert");

    await addLatency(driver, 2_000);
    await todos.addTodo("Slow add");
    await todos.waitForTitle("Slow add");
    expect(await todos.controlsEnabled("Slow add")).toBe(false);

    await restoreNetwork(driver);
    await todos.waitUntilSettled("Slow add");
    expect(await todos.controlsEnabled("Slow add")).toBe(true);
  });

  // The rollback tests assert the end state: offline, the request fails within milliseconds, so
  // the intermediate "row vanished" state is too brief to observe. The unit tests cover it.
  it("a failed add is rolled back and the title returned to the input", async () => {
    const todos = await signedInTodoPage("opt-add-fail");

    await goOffline(driver);
    await todos.addTodo("Will fail");
    expect(await todos.alertText()).toBe(t("errors.createTodo"));
    expect(await todos.rowCount()).toBe(0);
    expect(await todos.inputValue()).toBe("Will fail");

    await restoreNetwork(driver);
    await driver.navigate().refresh();
    await todos.waitUntilReady();
    expect(await todos.rowCount()).toBe(0);
  });

  it("a failed delete is restored at its original position", async () => {
    const todos = await signedInTodoPage("opt-del-fail");
    for (const title of ["One", "Two", "Three"]) await todos.addAndSettle(title);

    await goOffline(driver);
    await todos.delete("Two");
    expect(await todos.alertText()).toBe(t("errors.deleteTodo"));
    expect(await todos.titles()).toEqual(["One", "Two", "Three"]);

    await restoreNetwork(driver);
    await todos.waitForSaved("Two");
  });

  it("a double click on Add creates one to-do and no empty-title error", async () => {
    const todos = await signedInTodoPage("opt-double");

    await addLatency(driver, 1_500);
    await todos.typeTitle("Once");
    await todos.clickAdd();
    await todos.clickAdd();

    expect(await todos.hasAlert()).toBe(false);
    expect(await todos.rowCount()).toBe(1);

    await restoreNetwork(driver);
    await todos.waitUntilSettled("Once");
    await todos.waitForSaved("Once");
    await driver.navigate().refresh();
    await todos.waitUntilReady();
    expect(await todos.titles()).toEqual(["Once"]);
  });

  it("several quick adds keep their order after a reload", async () => {
    const todos = await signedInTodoPage("opt-order");

    // If this ever fails it is the ordering trade-off (OptimisticAddDeletePlan.md section 4,
    // item 11), not a test bug.
    for (const title of ["A", "B", "C"]) await todos.addTodo(title);
    for (const title of ["A", "B", "C"]) {
      await todos.waitUntilSettled(title);
      await todos.waitForSaved(title);
    }

    await driver.navigate().refresh();
    await todos.waitUntilReady();
    expect(await todos.titles()).toEqual(["A", "B", "C"]);
  });
});
