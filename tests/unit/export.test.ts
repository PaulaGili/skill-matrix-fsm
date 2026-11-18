import { describe, expect, it } from "vitest";
import { matrixTable, safeCell, toCsv } from "@/lib/domain/export";
import { buildCells } from "@/lib/domain/matrix";
import { translator } from "@/lib/i18n/translate";

const TODAY = "2026-11-16";

describe("matrixTable", () => {
  const persons = [
    { id: "p1", displayName: "Bieri, Marco" },
    { id: "p2", displayName: "Graf, Eva" },
  ];
  const skills = [
    { id: "s1", name: "Welding" },
    { id: "s2", name: "First Aid" },
  ];
  const cells = buildCells(
    [
      { id: "a1", personId: "p1", skillId: "s1", startDate: "2026-01-01", endDate: null, levelName: "Expert" },
      { id: "a2", personId: "p1", skillId: "s2", startDate: "2025-01-01", endDate: "2026-11-01", levelName: null },
    ],
    new Set(["a1"]),
    TODAY,
  );

  it("has a header row and one row per person", () => {
    expect(matrixTable(persons, skills, cells, { statuses: [], levels: [] }, translator("en"))).toEqual([
      ["Person", "Welding", "First Aid"],
      ["Bieri, Marco", "Valid, Expert, no end date, certificate", "Expired, ended 01.11.2026"],
      ["Graf, Eva", "", ""],
    ]);
  });

  it("leaves out the cells that the filters hide", () => {
    const table = matrixTable(persons, skills, cells, { statuses: ["expired"], levels: [] }, translator("en"));
    expect(table[1]).toEqual(["Bieri, Marco", "", "Expired, ended 01.11.2026"]);
  });

  it("writes the cell texts in German, with the names as they are", () => {
    const table = matrixTable(persons, skills, cells, { statuses: [], levels: [] }, translator("de"));
    expect(table[0]).toEqual(["Person", "Welding", "First Aid"]);
    expect(table[1]).toEqual(["Bieri, Marco", "Gültig, Expert, kein Enddatum, Zertifikat", "Abgelaufen, beendet am 01.11.2026"]);
  });
});

describe("toCsv", () => {
  it("quotes values with commas, quotes or line breaks", () => {
    expect(toCsv([["Bieri, Marco", 'say "hi"', "plain"]])).toBe('"Bieri, Marco","say ""hi""",plain');
  });

  it("uses another separator and quotes values that contain it", () => {
    expect(toCsv([["Bieri, Marco", "a;b", "plain"]], ";")).toBe('Bieri, Marco;"a;b";plain');
  });

  it("separates rows with CRLF", () => {
    expect(toCsv([["a"], ["b"]])).toBe("a\r\nb");
  });

  it("keeps a value that looks like a formula as text", () => {
    expect(safeCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(safeCell("Welding")).toBe("Welding");
    expect(toCsv([["@cmd", "-1"]])).toBe("'@cmd,'-1");
  });
});
