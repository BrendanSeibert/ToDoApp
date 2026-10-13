import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WebDriver } from "selenium-webdriver";

// This package is an ES module, where `__dirname` does not exist by definition.
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../artifacts");

/** Saves a screenshot and the page HTML so a failure can be diagnosed afterwards. */
export async function saveArtifacts(driver: WebDriver, testName: string): Promise<void> {
  const safe = testName.replace(/[^a-z0-9]+/gi, "-").slice(0, 80);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${stamp}-${safe}.png`), await driver.takeScreenshot(), "base64");
  await writeFile(path.join(dir, `${stamp}-${safe}.html`), await driver.getPageSource());
}
