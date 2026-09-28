import { afterEach, describe, expect, it, vi } from "vitest";
import en from "~/i18n/en.json";
import { translate, type Dictionary, type TranslationKey } from "~/i18n/translate";

const dictionary: Dictionary = {
  navbar: { todos: "Todos" },
  todoItem: { deleteAria: "Delete {title}", twice: "{name} and {name}" },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("translate", () => {
  it("looks up a nested key", () => {
    expect(translate(dictionary, "navbar.todos")).toBe("Todos");
  });

  it("replaces a placeholder with the matching param", () => {
    expect(translate(dictionary, "todoItem.deleteAria", { title: "Buy milk" })).toBe("Delete Buy milk");
  });

  it("replaces every occurrence of a placeholder and stringifies numbers", () => {
    expect(translate(dictionary, "todoItem.twice", { name: 3 })).toBe("3 and 3");
  });

  it("leaves a placeholder untouched when its param is not supplied", () => {
    expect(translate(dictionary, "todoItem.deleteAria", {})).toBe("Delete {title}");
    expect(translate(dictionary, "todoItem.deleteAria")).toBe("Delete {title}");
  });

  it("does not treat param values as placeholders or replacement patterns", () => {
    expect(translate(dictionary, "todoItem.deleteAria", { title: "$& {title}" })).toBe("Delete $& {title}");
  });

  it("returns the key and warns when the key does not exist", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(translate(dictionary, "navbar.missing")).toBe("navbar.missing");
    expect(translate(dictionary, "nothing.here.at.all")).toBe("nothing.here.at.all");
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("returns the key when it points at a group instead of a string", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(translate(dictionary, "navbar")).toBe("navbar");
  });

  it("does not resolve keys through the prototype chain", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(translate(dictionary, "navbar.constructor")).toBe("navbar.constructor");
    expect(translate(dictionary, "toString")).toBe("toString");
  });
});

describe("TranslationKey", () => {
  it("only accepts keys that exist in en.json", () => {
    const valid: TranslationKey = "navbar.todos";
    // @ts-expect-error a mistyped key must fail to compile
    const invalid: TranslationKey = "navbar.todo";

    expect([valid, invalid]).toHaveLength(2);
  });
});

describe("en.json", () => {
  function leaves(node: unknown, path: string[] = []): Array<[string, unknown]> {
    if (typeof node === "object" && node !== null) {
      return Object.entries(node).flatMap(([key, child]) => leaves(child, [...path, key]));
    }
    return [[path.join("."), node]];
  }

  it("contains only non-empty strings", () => {
    for (const [key, value] of leaves(en)) {
      expect(typeof value, key).toBe("string");
      expect((value as string).trim(), key).not.toBe("");
    }
  });

  it("resolves every leaf through translate", () => {
    for (const [key, value] of leaves(en)) {
      expect(translate(en, key), key).toBe(value);
    }
  });
});
