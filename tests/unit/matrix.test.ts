import { describe, expect, it } from "vitest";
import {
  inColumnOrder,
  buildCells,
  cellKey,
  HELD_TODAY,
  cellPasses,
  filterPersons,
  filterSkills,
  indexAssignments,
  personPasses,
  skillsWithMatches,
  sortRank,
  type CellFilter,
} from "@/lib/domain/matrix";

const TODAY = "2026-11-16";

const persons = [
  { displayName: "Bieri, Marco", isTechnician: true },
  { displayName: "Bieri, Marco", isTechnician: false },
  { displayName: "Graf, Eva", isTechnician: true },
  { displayName: "(no name) D74C20", isTechnician: false },
];

describe("filterPersons", () => {
  it("shows only technicians by default", () => {
    expect(filterPersons(persons, "", false)).toEqual([persons[0], persons[2]]);
  });

  it("shows everyone when system users are included", () => {
    expect(filterPersons(persons, "", true)).toHaveLength(4);
  });

  it("matches every word of the search in any order, ignoring case", () => {
    expect(filterPersons(persons, "  eva ", false)).toEqual([persons[2]]);
    expect(filterPersons(persons, "marco bieri", false)).toEqual([persons[0]]);
    expect(filterPersons(persons, "BIERI", true)).toHaveLength(2);
    expect(filterPersons(persons, "marco graf", true)).toEqual([]);
  });
});

describe("filterSkills", () => {
  const skills = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("returns all skills when nothing is selected", () => {
    expect(filterSkills(skills, [])).toEqual(skills);
  });

  it("returns the selected skills in catalogue order", () => {
    expect(filterSkills(skills, ["c", "a"])).toEqual([skills[0], skills[2]]);
  });
});

const assignment = (id: string, endDate: string | null, startDate = "2026-01-01") => ({
  id,
  personId: "p1",
  skillId: "s1",
  startDate,
  endDate,
  levelName: "Basic",
});

describe("indexAssignments", () => {
  const key = cellKey("p1", "s1");

  it("keeps the assignment that is valid longest when FSM has duplicates", () => {
    const expired = assignment("old", "2026-01-31");
    const current = assignment("new", "2027-01-31");
    const open = assignment("open", null);
    expect(indexAssignments([current, expired], TODAY).get(key)).toBe(current);
    expect(indexAssignments([expired, current], TODAY).get(key)).toBe(current);
    expect(indexAssignments([current, open, expired], TODAY).get(key)).toBe(open);
  });

  it("prefers the assignment that is valid today over a renewal that starts later", () => {
    const current = assignment("current", "2026-12-31");
    const renewal = assignment("renewal", "2028-12-31", "2027-01-01");
    expect(indexAssignments([current, renewal], TODAY).get(key)).toBe(current);
    expect(indexAssignments([renewal, current], TODAY).get(key)).toBe(current);
  });
});

describe("buildCells", () => {
  const cells = buildCells([assignment("a1", "2026-11-20")], new Set(["a1"]), TODAY);
  const cell = cells.get(cellKey("p1", "s1"))!;

  it("adds the status and the certificate flag", () => {
    expect(cell.status).toBe("expiring");
    expect(cell.hasCertificate).toBe(true);
  });
});

describe("cellPasses and personPasses", () => {
  // p1: s1 valid, Expert, with certificate; s2 expired, Basic, no certificate.
  // p2: s1 expiring, Basic, no certificate.
  const cells = buildCells(
    [
      { id: "a1", personId: "p1", skillId: "s1", startDate: "2026-01-01", endDate: null, levelName: "Expert" },
      { id: "a2", personId: "p1", skillId: "s2", startDate: "2025-01-01", endDate: "2026-11-01", levelName: "Basic" },
      { id: "a3", personId: "p2", skillId: "s1", startDate: "2026-01-01", endDate: "2026-11-20", levelName: "Basic" },
    ],
    new Set(["a1"]),
    TODAY,
  );
  const all = ["s1", "s2"];
  const stay = (selected: string[], statuses: CellFilter[], levels: string[] = []) =>
    ["p1", "p2", "p3"].filter((id) => personPasses(id, selected, all, cells, { statuses, levels }));

  it("shows everyone without filters", () => {
    expect(stay([], [])).toEqual(["p1", "p2", "p3"]);
  });

  it("with a skill selected and no status or level, still shows everyone", () => {
    expect(stay(["s1"], [])).toEqual(["p1", "p2", "p3"]);
  });

  it("with a skill and the held-today statuses, keeps who holds every selected skill", () => {
    expect(stay(["s1"], HELD_TODAY)).toEqual(["p1", "p2"]);
    expect(stay(["s2"], HELD_TODAY)).toEqual([]);
    expect(stay(["s1", "s2"], HELD_TODAY)).toEqual([]);
  });

  it("with a skill and a status, the status applies to that skill", () => {
    expect(stay(["s2"], ["expired"])).toEqual(["p1"]);
    expect(stay(["s1"], ["expired"])).toEqual([]);
    expect(stay(["s1"], ["expiring"])).toEqual(["p2"]);
  });

  it("treats several statuses as alternatives", () => {
    expect(stay([], ["expired", "expiring"])).toEqual(["p1", "p2"]);
  });

  it("requires a missing certificate on top of the status", () => {
    expect(stay([], ["noCertificate"])).toEqual(["p1", "p2"]);
    expect(stay([], ["valid", "noCertificate"])).toEqual([]);
    expect(stay([], ["expiring", "noCertificate"])).toEqual(["p2"]);
    expect(stay(["s1"], ["noCertificate"])).toEqual(["p2"]);
  });

  it("checks one cell at a time: status and certificate must match in the same cell", () => {
    expect(cellPasses(cells.get(cellKey("p1", "s1"))!, { statuses: ["valid", "noCertificate"], levels: [] })).toBe(false);
    expect(cellPasses(cells.get(cellKey("p1", "s2"))!, { statuses: ["expired", "noCertificate"], levels: [] })).toBe(true);
  });

  it("filters by level, alone and together with a skill or a status", () => {
    expect(stay([], [], ["Expert"])).toEqual(["p1"]);
    expect(stay([], [], ["Basic", "Expert"])).toEqual(["p1", "p2"]);
    expect(stay(["s1"], [], ["Basic"])).toEqual(["p2"]);
    expect(stay(["s2"], [], ["Basic"])).toEqual(["p1"]);
    expect(stay(["s2"], HELD_TODAY, ["Basic"])).toEqual([]);
    expect(stay([], ["expired"], ["Basic"])).toEqual(["p1"]);
    expect(stay([], ["expired"], ["Expert"])).toEqual([]);
  });

  it("hides the columns without a matching cell when a filter is on", () => {
    const skills = [{ id: "s1" }, { id: "s2" }];
    const ids = (statuses: CellFilter[], levels: string[] = []) => skillsWithMatches(skills, ["p1", "p2"], cells, { statuses, levels }).map((s) => s.id);
    expect(ids([])).toEqual(["s1", "s2"]);
    expect(ids(["expired"])).toEqual(["s2"]);
    expect(ids(["valid", "expiring"])).toEqual(["s1"]);
    expect(ids([], ["Expert"])).toEqual(["s1"]);
    expect(ids(["notYetValid"])).toEqual([]);
  });
});

describe("sortRank", () => {
  const cells = buildCells(
    [
      { id: "a1", personId: "p1", skillId: "s1", startDate: "2026-01-01", endDate: null, levelName: "Expert" },
      { id: "a2", personId: "p1", skillId: "s2", startDate: "2025-01-01", endDate: "2026-11-01", levelName: "Basic" },
      { id: "a3", personId: "p2", skillId: "s1", startDate: "2026-01-01", endDate: "2026-11-20", levelName: "Basic" },
    ],
    new Set(["a1"]),
    TODAY,
  );

  it("ranks problems first and unassigned last", () => {
    const rank = (personId: string, skillId: string) => sortRank(cells.get(cellKey(personId, skillId)));
    expect(rank("p1", "s2")).toBeLessThan(rank("p2", "s1"));
    expect(rank("p2", "s1")).toBeLessThan(rank("p1", "s1"));
    expect(rank("p1", "s1")).toBeLessThan(rank("p3", "s1"));
  });
});

describe("inColumnOrder", () => {
  const skill = (id: string) => ({ id });

  it("puts the skills in the dragged order and new skills after them", () => {
    const ids = (list: { id: string }[], order: string[]) => inColumnOrder(list, order).map((s) => s.id);
    expect(ids([skill("A"), skill("B"), skill("C")], ["C", "A", "B"])).toEqual(["C", "A", "B"]);
    expect(ids([skill("A"), skill("B")], [])).toEqual(["A", "B"]);
    // F is new and E was dragged to the end of five: E stays before F, as in the table.
    expect(ids([skill("E"), skill("F")], ["A", "B", "C", "D", "E"])).toEqual(["E", "F"]);
  });
});
