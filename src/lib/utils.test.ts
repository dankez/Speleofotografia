import { expect, test, describe } from "bun:test";
import { cn } from "./utils";

describe("cn utility", () => {
  test("concatenates strings", () => {
    expect(cn("base", "extra")).toBe("base extra");
  });

  test("handles conditional classes", () => {
    expect(cn("base", true && "is-true", false && "is-false")).toBe("base is-true");
    expect(cn("base", null, undefined, 0, "")).toBe("base");
  });

  test("handles object-based classes", () => {
    expect(cn("base", { "is-active": true, "is-disabled": false })).toBe("base is-active");
  });

  test("handles array-based classes", () => {
    expect(cn(["a", "b"], ["c"])).toBe("a b c");
  });

  test("handles nested classes", () => {
    expect(cn("base", ["extra", { nested: true }])).toBe("base extra nested");
  });

  test("returns empty string for empty input", () => {
    expect(cn()).toBe("");
  });

  test("merges conflicting tailwind classes", () => {
    // With tailwind-merge, the last one wins if they have the same prefix
    const result = cn("p-2", "p-4");
    expect(result).toContain("p-4");
    expect(result).not.toContain("p-2");
  });
});
