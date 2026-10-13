import { By } from "selenium-webdriver";
import { t } from "../helpers/strings";
import { BasePage } from "./BasePage";

const root = By.css(".todo-app .account-settings");
const email = By.css(".account-settings .account-email");
const deleteAccount = By.css(".account-settings button.danger");
const confirmDelete = By.css(".account-settings button.confirm");

function buttonWithText(text: string): By {
  return By.xpath(`//*[contains(@class,"account-settings")]//button[normalize-space()="${text}"]`);
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
    await (await this.visible(buttonWithText(t("account.cancel")))).click();
  }

  async confirmationVisible(): Promise<boolean> {
    return (await this.driver.getPageSource()).includes(t("account.deleteConfirmation"));
  }

  async isVisible(): Promise<boolean> {
    return (await this.driver.findElements(root)).length > 0;
  }
}
