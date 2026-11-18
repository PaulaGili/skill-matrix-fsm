import { describe, expect, it } from "vitest";
import { daysUntil, dueText, expiringWithin } from "@/lib/domain/expiry";

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
  });
});
