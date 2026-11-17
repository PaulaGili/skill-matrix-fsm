import { describe, expect, it } from "vitest";
import { splitForRetire } from "@/lib/domain/retire";

const TODAY = "2026-11-16";
const validity = (startDate: string, endDate: string | null) => ({ startDate, endDate });

describe("splitForRetire", () => {
  const open = validity("2026-01-01", null);
  const endsLater = validity("2026-01-01", "2027-01-01");
  const endsToday = validity("2026-01-01", TODAY);
  const alreadyEnded = validity("2025-01-01", "2026-11-15");
  const startsToday = validity(TODAY, null);
  const startsLater = validity("2026-12-01", "2027-12-01");

  it("ends what is valid today and removes what has not started before today", () => {
    const { toEnd, toRemove } = splitForRetire([open, endsLater, endsToday, alreadyEnded, startsToday, startsLater], TODAY);
    expect(toEnd).toEqual([open, endsLater, endsToday]);
    expect(toRemove).toEqual([startsToday, startsLater]);
  });

  it("leaves assignments that already ended alone", () => {
    expect(splitForRetire([alreadyEnded], TODAY)).toEqual({ toEnd: [], toRemove: [] });
  });
});
