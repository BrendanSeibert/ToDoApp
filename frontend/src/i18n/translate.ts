import type en from "./en.json";

export interface Dictionary {
  [key: string]: string | Dictionary;
}

// Every leaf of the dictionary as a dot-separated path, e.g. "navbar.todos", so a
// mistyped key fails to compile instead of showing up at runtime.
type LeafPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : LeafPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = LeafPaths<typeof en>;
export type TranslationParams = Record<string, string | number>;

// A missing key renders as the key itself: visible in the UI, unlike an empty string.
export function translate(dictionary: Dictionary, key: string, params?: TranslationParams): string {
  let node: string | Dictionary | undefined = dictionary;
  for (const segment of key.split(".")) {
    node = typeof node === "object" ? node[segment] : undefined;
  }

  if (typeof node !== "string") {
    if (import.meta.env.DEV) console.warn(`Missing translation for "${key}"`);
    return key;
  }

  if (!params) return node;
  return node.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  );
}
