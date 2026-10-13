import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const driverFactory = vi.fn();
vi.mock("neo4j-driver", () => ({
  default: {
    driver: (...args: unknown[]) => driverFactory(...args),
    auth: { basic: (user: string, password: string) => ({ user, password }) },
  },
}));

const ensureConstraints = vi.fn();
vi.mock("~/lib/schema", () => ({ ensureConstraints: (...args: unknown[]) => ensureConstraints(...args) }));

const originalEnv = { ...process.env };

function fakeDriver() {
  return { close: vi.fn(async () => undefined) };
}

// The module keeps its driver at module level, so each test gets a fresh copy.
async function load() {
  return import("~/lib/neo4j");
}

beforeEach(() => {
  vi.resetModules();
  driverFactory.mockReset();
  ensureConstraints.mockReset();
  ensureConstraints.mockResolvedValue(undefined);
  process.env.NEO4J_URI = "bolt://db:7687";
  process.env.NEO4J_USER = "neo4j";
  process.env.NEO4J_PASSWORD = "secret";
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("getDriver", () => {
  it.each(["NEO4J_URI", "NEO4J_USER", "NEO4J_PASSWORD"])("throws when %s is not set", async (name) => {
    delete process.env[name];
    const { getDriver } = await load();

    expect(() => getDriver()).toThrow(/NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD/);
    expect(driverFactory).not.toHaveBeenCalled();
  });

  it("creates the driver with the configured URI and credentials", async () => {
    const driver = fakeDriver();
    driverFactory.mockReturnValue(driver);
    const { getDriver } = await load();

    expect(getDriver()).toBe(driver);
    expect(driverFactory).toHaveBeenCalledTimes(1);
    expect(driverFactory).toHaveBeenCalledWith("bolt://db:7687", { user: "neo4j", password: "secret" });
  });

  it("reuses one driver and ensures constraints only once", async () => {
    driverFactory.mockReturnValue(fakeDriver());
    const { getDriver } = await load();

    expect(getDriver()).toBe(getDriver());
    expect(driverFactory).toHaveBeenCalledTimes(1);
    expect(ensureConstraints).toHaveBeenCalledTimes(1);
  });

  it("returns the driver and logs when ensuring constraints fails", async () => {
    const driver = fakeDriver();
    driverFactory.mockReturnValue(driver);
    const failure = new Error("no constraints");
    ensureConstraints.mockRejectedValue(failure);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { getDriver } = await load();

    expect(getDriver()).toBe(driver);
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalledWith("Failed to ensure Neo4j constraints", failure);
  });
});

describe("closeDriver", () => {
  it("closes the driver and builds a new one on the next getDriver", async () => {
    const first = fakeDriver();
    const second = fakeDriver();
    driverFactory.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const { closeDriver, getDriver } = await load();
    getDriver();

    await closeDriver();

    expect(first.close).toHaveBeenCalledTimes(1);
    expect(getDriver()).toBe(second);
    expect(driverFactory).toHaveBeenCalledTimes(2);
  });

  it("does nothing when there is no driver", async () => {
    const { closeDriver } = await load();

    await expect(closeDriver()).resolves.toBeUndefined();
    expect(driverFactory).not.toHaveBeenCalled();
  });
});
