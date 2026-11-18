import { describe, expect, it } from "vitest";
import { addDays, assignmentStatus, formatDate, isIsoDate, todayIso, validateValidity, validityHint } from "@/lib/domain/status";

const TODAY = "2026-11-16";
const status = (startDate: string | null, endDate: string | null) => assignmentStatus({ startDate, endDate }, TODAY);

describe("assignmentStatus", () => {
  it("is unassigned without an assignment", () => {
    expect(assignmentStatus(null, TODAY)).toBe("unassigned");
  });

  it("is valid without an end date", () => {
    expect(status("2026-01-01", null)).toBe("valid");
    expect(status(null, null)).toBe("valid");
  });

  it("treats the end date as the last valid day", () => {
    expect(status(null, TODAY)).toBe("expiring");
    expect(status(null, "2026-11-15")).toBe("expired");
  });

  it("uses a 30-day window for expiring", () => {
    expect(status(null, "2026-12-16")).toBe("expiring");
    expect(status(null, "2026-12-17")).toBe("valid");
  });

  it("is not yet valid when the start date is in the future", () => {
    expect(status("2026-11-17", null)).toBe("notYetValid");
    expect(status("2026-11-20", "2026-11-25")).toBe("notYetValid");
    expect(status(TODAY, null)).toBe("valid");
  });
});

describe("todayIso", () => {
  it("uses the Zurich date, not the UTC date", () => {
    const lateEvening = new Date("2026-11-16T23:30:00Z");
    expect(todayIso(lateEvening)).toBe("2026-11-17");
    expect(todayIso(lateEvening, "UTC")).toBe("2026-11-16");
  });
});

describe("addDays", () => {
  it("crosses months, years and leap days", () => {
    expect(addDays("2026-11-16", 30)).toBe("2026-12-16");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-11-16", -1)).toBe("2026-11-15");
  });
});

describe("formatDate", () => {
  it("shows dates in the Swiss format", () => {
    expect(formatDate("2026-11-07")).toBe("07.11.2026");
  });
});

describe("validityHint", () => {
  it("shows the date that matters for the status", () => {
    expect(validityHint({ startDate: "2026-01-01", endDate: "2026-11-29" }, "expiring")).toBe("until 29.11.2026");
    expect(validityHint({ startDate: "2026-01-01", endDate: "2027-06-30" }, "valid")).toBe("until 30.06.2027");
    expect(validityHint({ startDate: "2026-01-01", endDate: null }, "valid")).toBe("no end date");
    expect(validityHint({ startDate: "2025-01-01", endDate: "2026-10-27" }, "expired")).toBe("ended 27.10.2026");
    expect(validityHint({ startDate: "2026-12-02", endDate: null }, "notYetValid")).toBe("from 02.12.2026");
  });
});

describe("isIsoDate", () => {
  it("accepts only real calendar dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("16.11.2026")).toBe(false);
    expect(isIsoDate("2026-1-5")).toBe(false);
  });
});

describe("validateValidity", () => {
  it("allows empty and equal dates", () => {
    expect(validateValidity(null, null)).toBeNull();
    expect(validateValidity("2026-01-01", null)).toBeNull();
    expect(validateValidity("2026-01-01", "2026-01-01")).toBeNull();
  });

  it("rejects an end date before the start date", () => {
    expect(validateValidity("2026-02-01", "2026-01-31")).toMatch(/must not be before/);
  });

  it("rejects an end date in the past when the start is empty, because empty means today", () => {
    expect(validateValidity(null, "2026-11-10", "2026-11-17")).toMatch(/in the past/);
    expect(validateValidity(null, "2026-11-17", "2026-11-17")).toBeNull();
    expect(validateValidity("2026-01-01", "2026-11-10", "2026-11-17")).toBeNull();
  });

  it("rejects malformed dates", () => {
    expect(validateValidity("2026-13-01", null)).toMatch(/Valid from/);
    expect(validateValidity(null, "tomorrow")).toMatch(/Valid to/);
  });
});
