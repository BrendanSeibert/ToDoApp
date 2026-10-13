import { By, until, type WebDriver, type WebElement } from "selenium-webdriver";
import { config } from "../config";

export abstract class BasePage {
  constructor(protected readonly driver: WebDriver) {}

  /** Waits for the element to exist in the DOM. */
  protected async find(locator: By): Promise<WebElement> {
    return this.driver.wait(until.elementLocated(locator), config.waitMs);
  }

  /** Waits for the element to exist and be visible. */
  protected async visible(locator: By): Promise<WebElement> {
    const element = await this.find(locator);
    await this.driver.wait(until.elementIsVisible(element), config.waitMs);
    return element;
  }

  /**
   * Waits until a condition returns a truthy value, retrying (handy for re-rendered rows).
   * `timeoutMs` defaults to config.waitMs; raise it only for conditions that are slow by nature.
   */
  protected async waitUntil<T>(
    description: string,
    condition: () => Promise<T | false | null | undefined>,
    timeoutMs: number = config.waitMs,
  ): Promise<T> {
    // Errors thrown by the condition are retried (stale element, not there yet), but the last
    // one is remembered and added to the timeout message. Without it a typo'd selector or an
    // ElementNotInteractableError would only ever show up as "Timed out waiting for: ...".
    let lastError: unknown;
    try {
      const result = await this.driver.wait(async () => {
        try {
          const value = await condition();
          lastError = undefined;
          return value || false;
        } catch (error) {
          lastError = error;
          return false;
        }
      }, timeoutMs, `Timed out waiting for: ${description}`);
      return result as T;
    } catch (error) {
      if (lastError === undefined) throw error;
      throw new Error(`${(error as Error).message}. Last error while waiting: ${String(lastError)}`);
    }
  }
}
