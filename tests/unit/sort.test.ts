import { describe, expect, it } from "vitest";
import { sortRows } from "@/lib/domain/sort";

const rows = [
  { name: "Welding", count: 5 },
  { name: "First Aid", count: 12 },
  { name: "Crane Operation", count: 1 },
];

describe("sortRows", () => {
  it("sorts texts by alphabet and numbers by size", () => {
    expect(sortRows(rows, (row) => row.name, false).map((row) => row.name)).toEqual(["Crane Operation", "First Aid", "Welding"]);
    expect(sortRows(rows, (row) => row.count, false).map((row) => row.count)).toEqual([1, 5, 12]);
  });

  it("turns the order around and leaves the given rows as they were", () => {
    expect(sortRows(rows, (row) => row.count, true).map((row) => row.count)).toEqual([12, 5, 1]);
    expect(rows[0].name).toBe("Welding");
  });
});
