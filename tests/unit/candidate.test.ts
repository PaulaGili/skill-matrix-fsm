import { describe, expect, it } from "vitest";
import { fromScopedName, isOwnName, toScopedName } from "@/lib/candidate";

describe("candidate namespace", () => {
  it("adds and strips the prefix", () => {
    expect(toScopedName("  Welding ")).toBe("tester::Welding");
    expect(fromScopedName("tester::Welding")).toBe("Welding");
  });

  it("only treats names with our prefix as ours", () => {
    expect(isOwnName("tester::Welding")).toBe(true);
    expect(isOwnName("other::Welding")).toBe(false);
    expect(isOwnName("Welding")).toBe(false);
    expect(isOwnName("xtester::Welding")).toBe(false);
  });
});
