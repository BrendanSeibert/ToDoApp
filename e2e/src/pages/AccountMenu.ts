import { By, Key, Origin } from "selenium-webdriver";
import { t } from "../helpers/strings";
import { BasePage } from "./BasePage";

const root = By.css(".todo-app .account-settings");
const email = By.css(".account-settings .account-email");
const deleteAccount = By.css(".account-settings button.danger");
// The confirmation is a popover rendered into <body>, outside .account-settings.
const dialog = By.css('[role="alertdialog"]');
const confirmDelete = By.css('[role="alertdialog"] button.confirm');
const closeIcon = By.css('[role="alertdialog"] button.popover-close');

function buttonWithText(text: string): By {
  return By.xpath(`//*[contains(@class,"account-settings")]//button[normalize-space()="${text}"]`);
}

function dialogButtonWithText(text: string): By {
  return By.xpath(`//*[@role="alertdialog"]//button[normalize-space()="${text}"]`);
}

export class AccountMenu extends BasePage {
  async shownEmail(): Promise<string> {
    return (await this.visible(email)).getText();
  }

  async logOut(): Promise<void> {
    await (await this.visible(buttonWithText(t("account.logout")))).click();
  }

  async startDelete(): Promise<void> {
    await (await this.visible(deleteAccount)).click();
    await this.visible(confirmDelete);
  }

  async confirmDeletion(): Promise<void> {
    await (await this.visible(confirmDelete)).click();
  }

  async cancelDeletion(): Promise<void> {
    await (await this.visible(dialogButtonWithText(t("account.cancel")))).click();
  }

  async closeDeletionWithCloseIcon(): Promise<void> {
    await (await this.visible(closeIcon)).click();
  }

  async closeDeletionWithEscape(): Promise<void> {
    await this.driver.actions().sendKeys(Key.ESCAPE).perform();
  }

  /** Presses the dark backdrop, near the top-left corner of the window and well away from the dialog. */
  async closeDeletionByClickingOutside(): Promise<void> {
    await this.driver.actions().move({ origin: Origin.VIEWPORT, x: 5, y: 5 }).click().perform();
  }

  async pressTab(times: number, shift = false): Promise<void> {
    const actions = this.driver.actions();
    if (shift) actions.keyDown(Key.SHIFT);
    for (let i = 0; i < times; i++) actions.sendKeys(Key.TAB);
    if (shift) actions.keyUp(Key.SHIFT);
    await actions.perform();
  }

  /** The visible text of the focused control inside the dialog, or null when focus is outside it. */
  async focusedDialogControl(): Promise<string | null> {
    return this.driver.executeScript<string | null>(
      `const el = document.activeElement;
       return el && el.closest('[role="alertdialog"]') ? (el.getAttribute("aria-label") || el.textContent.trim()) : null;`,
    );
  }

  async dialogVisible(): Promise<boolean> {
    return (await this.driver.findElements(dialog)).length > 0;
  }

  async confirmationVisible(): Promise<boolean> {
    return (await this.driver.getPageSource()).includes(t("account.deleteConfirmation"));
  }

  async isVisible(): Promise<boolean> {
    return (await this.driver.findElements(root)).length > 0;
  }
}
