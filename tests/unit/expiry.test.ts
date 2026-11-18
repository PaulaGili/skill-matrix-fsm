import { describe, expect, it } from "vitest";
import { alreadyExpired, daysUntil, dueText, expiringWithin } from "@/lib/domain/expiry";

const TODAY = "2026-11-17";

describe("expiringWithin", () => {
  const assignments = [
    { id: "open", endDate: null },
    { id: "expired", endDate: "2026-11-16" },
    { id: "later", endDate: "2026-12-17" },
    { id: "today", endDate: "2026-11-17" },
    { id: "soon", endDate: "2026-11-20" },
    { id: "far", endDate: "2026-12-18" },
  ];

  it("keeps what ends today or within the window, soonest first", () => {
    expect(expiringWithin(assignments, TODAY, 30).map((a) => a.id)).toEqual(["today", "soon", "later"]);
  });

  it("widens with the number of days", () => {
    expect(expiringWithin(assignments, TODAY, 90).map((a) => a.id)).toEqual(["today", "soon", "later", "far"]);
  });
});

describe("daysUntil and dueText", () => {
  it("counts calendar days across a month and a year", () => {
    expect(daysUntil("2026-11-17", TODAY)).toBe(0);
    expect(daysUntil("2026-12-01", TODAY)).toBe(14);
    expect(daysUntil("2027-01-01", TODAY)).toBe(45);
  });

  it("words the due date", () => {
    expect(dueText(0)).toEqual({ key: "due.today" });
    expect(dueText(1)).toEqual({ key: "due.tomorrow" });
    expect(dueText(14)).toEqual({ key: "due.inDays", params: { count: 14 } });
    expect(dueText(-1)).toEqual({ key: "due.yesterday" });
    expect(dueText(-20)).toEqual({ key: "due.daysAgo", params: { count: 20 } });
  });
});

describe("alreadyExpired", () => {
  it("keeps what ended before today, the latest first", () => {
    const list = [
      { id: "old", endDate: "2026-01-31" },
      { id: "today", endDate: "2026-11-16" },
      { id: "open", endDate: null },
      { id: "recent", endDate: "2026-11-15" },
    ];
    expect(alreadyExpired(list, "2026-11-16").map((a) => a.id)).toEqual(["recent", "old"]);
  });
});
