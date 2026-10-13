import { By, Key, type WebElement } from "selenium-webdriver";
import { config } from "../config";
import { t } from "../helpers/strings";
import { BasePage } from "./BasePage";

interface ServerTodo {
  title: string;
  completed: boolean;
}

const root = By.css(".todo-app");
const input = By.css('.todo-list input[type="text"]');
const addButton = By.css(".todo-list .add-button");
const rows = By.css(".todo-list li.todo-item");
const alert = By.css('.todo-list [role="alert"]');
const title = By.css("label > span:last-of-type");
const checkboxInput = By.css("input.checkbox-input");
const checkboxIcon = By.css(".checkbox-icon");
const deleteButton = By.css("button.delete-button");

export class TodoPage extends BasePage {
  /** Waits for the signed-in screen and for the initial list fetch to finish. */
  async waitUntilReady(): Promise<void> {
    await this.visible(root);
    await this.waitUntilFormEnabled();
    await this.waitUntil("list finished loading", async () => {
      const source = await this.driver.getPageSource();
      return !source.includes(t("todos.loading"));
    });
  }

  /**
   * The input is disabled while the list loads or a create is in flight, so "enabled" is the
   * app's own readiness signal. Typing into a disabled input would throw.
   */
  private async waitUntilFormEnabled(): Promise<void> {
    await this.waitUntil("to-do form to be enabled", async () => (await this.visible(input)).isEnabled());
  }

  async navbarTitle(): Promise<string> {
    return (await this.visible(By.css(".navbar h1"))).getText();
  }

  async typeTitle(value: string): Promise<void> {
    await this.waitUntilFormEnabled();
    const field = await this.visible(input);
    await field.clear();
    await field.sendKeys(value);
  }

  async clickAdd(): Promise<void> {
    await (await this.visible(addButton)).click();
  }

  async addTodo(value: string): Promise<void> {
    await this.typeTitle(value);
    await this.clickAdd();
  }

  /**
   * Submits the form with the Enter key instead of the Add button. Pass a value to type first,
   * or omit it to press Enter in the input as it is (used for the empty-input scenarios).
   */
  async submitWithEnter(value?: string): Promise<void> {
    if (value !== undefined) await this.typeTitle(value);
    else await this.waitUntilFormEnabled();
    await (await this.visible(input)).sendKeys(Key.ENTER);
  }

  async inputValue(): Promise<string> {
    return (await (await this.visible(input)).getAttribute("value")) ?? "";
  }

  /**
   * Read in one browser call. With optimistic add the server's reply can replace a row between
   * `findElements` and a following `getText`, which raises StaleElementReferenceError; reading
   * every title inside a single script cannot be interleaved with a re-render.
   */
  async titles(): Promise<string[]> {
    return this.driver.executeScript<string[]>(
      `return Array.from(document.querySelectorAll(arguments[0])).map((row) => {
         const span = row.querySelector(arguments[1]);
         return span ? span.innerText.trim() : "";
       });`,
      ".todo-list li.todo-item",
      "label > span:last-of-type",
    );
  }

  /**
   * Finds the row and reads from it in one retried step, so a row swapped for the server's
   * version between the two calls is simply looked up again.
   */
  private async readRow<T>(value: string, read: (row: WebElement) => Promise<T>): Promise<T> {
    const result = await this.waitUntil(`row "${value}"`, async () => {
      const row = await this.findRow(value);
      return row === null ? null : { value: await read(row) };
    });
    return result.value;
  }

  async rowCount(): Promise<number> {
    return (await this.driver.findElements(rows)).length;
  }

  private async findRow(value: string): Promise<WebElement | null> {
    for (const row of await this.driver.findElements(rows)) {
      if ((await row.findElement(title).getText()) === value) return row;
    }
    return null;
  }

  async waitForTitle(value: string): Promise<void> {
    await this.waitUntil(`row "${value}" to appear`, () => this.findRow(value));
  }

  async waitForTitleGone(value: string): Promise<void> {
    await this.waitUntil(`row "${value}" to disappear`, async () => (await this.findRow(value)) === null);
  }

  /**
   * Toggles the to-do and returns only once the SERVER has the new state. The checkbox flips
   * immediately (the app updates optimistically), so without this wait a following reload
   * could abort the request and lose the change (plan section 3.5, item 8).
   */
  async toggle(value: string): Promise<void> {
    await this.waitUntilSettled(value);
    const before = await this.isCompleted(value);
    const row = await this.waitUntil(`row "${value}"`, () => this.findRow(value));
    await row.findElement(checkboxIcon).click();
    await this.waitUntil(
      `server to report "${value}" as ${before ? "not completed" : "completed"}`,
      async () => (await this.serverTodos()).some((todo) => todo.title === value && todo.completed === !before),
    );
  }

  /** Waits until the server has a to-do with this title. Call before reloading the page. */
  async waitForSaved(value: string): Promise<void> {
    await this.waitUntil(`server to have "${value}"`, async () =>
      (await this.serverTodos()).some((todo) => todo.title === value),
    );
  }

  /** Waits until the server no longer has a to-do with this title. Call before reloading the page. */
  async waitForSavedGone(value: string): Promise<void> {
    await this.waitUntil(`server to no longer have "${value}"`, async () =>
      (await this.serverTodos()).every((todo) => todo.title !== value),
    );
  }

  /**
   * Asks the API for the signed-in user's to-dos from inside the page, so the (HttpOnly)
   * session cookie is sent. Returns [] if the request fails, which makes callers keep waiting.
   */
  private async serverTodos(): Promise<ServerTodo[]> {
    const result = await this.driver.executeAsyncScript<ServerTodo[] | null>(
      `const url = arguments[0];
       const done = arguments[arguments.length - 1];
       fetch(url, { credentials: "include" })
         .then((response) => response.json())
         .then((body) => done(body.todos ?? null), () => done(null));`,
      `${config.apiUrl}/api/todos`,
    );
    return result ?? [];
  }

  async isCompleted(value: string): Promise<boolean> {
    return this.readRow(value, (row) => row.findElement(checkboxInput).isSelected());
  }

  /** Deletes the to-do. Waits for the row to settle first: a pending row's button is disabled. */
  async delete(value: string): Promise<void> {
    await this.waitUntilSettled(value);
    const row = await this.waitUntil(`row "${value}"`, () => this.findRow(value));
    await row.findElement(deleteButton).click();
  }

  /** True while the row exists and is still waiting for its server id (optimistic add). */
  async isPending(value: string): Promise<boolean> {
    return this.readRow(value, async (row) => (await row.getAttribute("aria-busy")) === "true");
  }

  /** Waits until the row exists and is no longer pending, i.e. it can be toggled or deleted. */
  async waitUntilSettled(value: string): Promise<void> {
    await this.waitUntil(`row "${value}" to settle`, async () => {
      const row = await this.findRow(value);
      return row !== null && (await row.getAttribute("aria-busy")) !== "true";
    });
  }

  /** True when the row's checkbox and delete button are both enabled. */
  async controlsEnabled(value: string): Promise<boolean> {
    return this.readRow(
      value,
      async (row) =>
        (await row.findElement(checkboxInput).isEnabled()) && (await row.findElement(deleteButton).isEnabled()),
    );
  }

  /** Adds a to-do and returns once the row is settled and the server has it. */
  async addAndSettle(value: string): Promise<void> {
    await this.addTodo(value);
    await this.waitForTitle(value);
    await this.waitUntilSettled(value);
    await this.waitForSaved(value);
  }

  async emptyStateVisible(): Promise<boolean> {
    return (await this.driver.getPageSource()).includes(t("todos.empty"));
  }

  async alertText(): Promise<string> {
    return (await this.visible(alert)).getText();
  }

  async hasAlert(): Promise<boolean> {
    return (await this.driver.findElements(alert)).length > 0;
  }

  async waitForAlertGone(description: string, timeoutMs?: number): Promise<void> {
    await this.waitUntil(description, async () => !(await this.hasAlert()), timeoutMs);
  }

  /**
   * Fails if the alert disappears before `ms` have passed, and returns once they have.
   * This is a polling wait with a deadline (not a fixed sleep): it checks the alert on every
   * poll and fails the moment it is gone. Used for the 15-second message-expiry test.
   */
  async expectAlertPersistsFor(ms: number): Promise<void> {
    const start = Date.now();
    await this.driver.wait(async () => {
      if (!(await this.hasAlert())) {
        throw new Error(`The alert disappeared after ${Date.now() - start} ms, expected it to last ${ms} ms`);
      }
      return Date.now() - start >= ms;
    }, ms + 5_000);
  }
}
