import { By } from "selenium-webdriver";
import { config } from "../config";
import { t } from "../helpers/strings";
import { BasePage } from "./BasePage";

const heading = By.css(".auth-forms h1");
const email = By.css('.auth-forms input[type="email"]');
const password = By.css('.auth-forms input[type="password"]');
const submit = By.css('.auth-forms button[type="submit"]');
const switchLink = By.css(".auth-forms .link-button");
const alert = By.css('.auth-forms [role="alert"]');

export class AuthPage extends BasePage {
  async open(): Promise<void> {
    await this.driver.get(config.baseUrl);
    await this.visible(heading);
  }

  async headingText(): Promise<string> {
    return (await this.visible(heading)).getText();
  }

  async showRegister(): Promise<void> {
    if ((await this.headingText()) === t("auth.register.heading")) return;
    await (await this.visible(switchLink)).click();
    await this.waitUntil("register heading", async () => (await this.headingText()) === t("auth.register.heading"));
  }

  async showLogin(): Promise<void> {
    if ((await this.headingText()) === t("auth.login.heading")) return;
    await (await this.visible(switchLink)).click();
    await this.waitUntil("login heading", async () => (await this.headingText()) === t("auth.login.heading"));
  }

  async fill(emailValue: string, passwordValue: string): Promise<void> {
    const emailInput = await this.visible(email);
    await emailInput.clear();
    await emailInput.sendKeys(emailValue);
    const passwordInput = await this.visible(password);
    await passwordInput.clear();
    await passwordInput.sendKeys(passwordValue);
  }

  async submit(): Promise<void> {
    await (await this.visible(submit)).click();
  }

  async register(emailValue: string, passwordValue: string): Promise<void> {
    await this.showRegister();
    await this.fill(emailValue, passwordValue);
    await this.submit();
  }

  async login(emailValue: string, passwordValue: string): Promise<void> {
    await this.showLogin();
    await this.fill(emailValue, passwordValue);
    await this.submit();
  }

  /** Text of the error alert; waits for it to appear. */
  async errorText(): Promise<string> {
    return (await this.visible(alert)).getText();
  }

  async hasError(): Promise<boolean> {
    return (await this.driver.findElements(alert)).length > 0;
  }

  /**
   * True when Chrome's own form validation rejects the current field values (no request was sent).
   * Note: Chrome only reports "too short" (`minLength`) for values it considers user-edited, and
   * `checkValidity()` has the same rule. This works because `fill()` types with real key events
   * (`sendKeys`). Do not "optimise" `fill()` to set `value` through a script: the form would then
   * look valid and the short-password test would fail.
   */
  async formIsInvalid(): Promise<boolean> {
    const input = await this.visible(password);
    return this.driver.executeScript<boolean>("return !arguments[0].form.checkValidity()", input);
  }
}
