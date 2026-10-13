import type { WebDriver } from "selenium-webdriver";

// createDriver() returns a Chrome driver, which has setNetworkConditions.
interface NetworkEmulation {
  setNetworkConditions(conditions: {
    offline: boolean;
    latency: number;
    download_throughput: number;
    upload_throughput: number;
  }): Promise<void>;
}

const chrome = (driver: WebDriver) => driver as unknown as NetworkEmulation;

export async function goOffline(driver: WebDriver): Promise<void> {
  await chrome(driver).setNetworkConditions({
    offline: true,
    latency: 0,
    download_throughput: -1,
    upload_throughput: -1,
  });
}

/** Holds every request open for about `ms` milliseconds so the "in flight" state is observable. */
export async function addLatency(driver: WebDriver, ms: number): Promise<void> {
  await chrome(driver).setNetworkConditions({
    offline: false,
    latency: ms,
    download_throughput: -1,
    upload_throughput: -1,
  });
}

export async function restoreNetwork(driver: WebDriver): Promise<void> {
  await chrome(driver).setNetworkConditions({
    offline: false,
    latency: 0,
    download_throughput: -1,
    upload_throughput: -1,
  });
}
