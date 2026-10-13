import en from "../../../frontend/src/i18n/en.json";

/** Looks up a UI string by dotted key, filling {placeholders}. Mirrors the app's own t(). */
export function t(key: string, params: Record<string, string | number> = {}): string {
  let node: unknown = en;
  for (const part of key.split(".")) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  if (typeof node !== "string") throw new Error(`Missing UI string: ${key}`);
  return node.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
