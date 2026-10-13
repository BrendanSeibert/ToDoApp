import { Browser, Builder, type WebDriver } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { config } from "./config";

export async function createDriver(): Promise<WebDriver> {
  const options = new chrome.Options();
  options.addArguments("--window-size=1280,900", "--disable-gpu", "--no-sandbox");
  if (!config.headed) options.addArguments("--headless=new");

  const driver = await new Builder().forBrowser(Browser.CHROME).setChromeOptions(options).build();
  await driver.manage().setTimeouts({ pageLoad: 30_000, script: 10_000 });
  return driver;
}

/**
 * Returns the browser to a logged-out, empty state. Cookies are per host, so the
 * browser must be on the app before they can be cleared.
 */
export async function resetBrowser(driver: WebDriver): Promise<void> {
  await driver.get(config.baseUrl);
  await driver.manage().deleteAllCookies();
  await driver.get(config.baseUrl);
}
