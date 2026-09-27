import { vi } from "vitest";
import type { Driver } from "neo4j-driver";

export function createMockSession(runImpl: (query: string, params: unknown) => unknown) {
  return {
    run: vi.fn(async (query: string, params: unknown) => runImpl(query, params)),
    close: vi.fn(async () => undefined),
  };
}

export function createMockDriver(runImpl: (query: string, params: unknown) => unknown): Driver {
  const session = createMockSession(runImpl);
  return {
    session: vi.fn(() => session),
  } as unknown as Driver;
}

export function fakeRecord(data: Record<string, unknown>) {
  return {
    get: (key: string) => data[key],
  };
}

export function fakeInteger(value: number) {
  return { toNumber: () => value };
}
