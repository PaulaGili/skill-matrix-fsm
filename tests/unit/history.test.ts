import { describe, expect, it } from "vitest";
import { MAX_CHANGES, canUndo, changedFields, markUndone, withChange, withNewAssignment, type Change, type Snapshot } from "@/lib/domain/history";

const snapshot = (changes: Partial<Snapshot> = {}): Snapshot => ({ levelId: "L1", levelName: "Basic", startDate: "2026-01-01", endDate: null, ...changes });
const change = (id: string, changes: Partial<Change> = {}): Change => ({
  id,
  at: "2026-11-17T10:00:00Z",
  kind: "edited",
  skillId: "s1",
  skillName: "Welding",
  personId: "p1",
  personName: "Bieri, Marco",
  assignmentId: "a1",
  before: snapshot(),
  after: snapshot({ endDate: "2027-12-31" }),
  lostCertificates: 0,
  undone: false,
  ...changes,
});

describe("history", () => {
  it("puts the newest change first and keeps a limited number", () => {
    const many = Array.from({ length: MAX_CHANGES }, (_, index) => change(`c${index}`));
    const result = withChange(many, change("new"));
    expect(result).toHaveLength(MAX_CHANGES);
    expect(result[0].id).toBe("new");
    expect(result.at(-1)?.id).toBe(`c${MAX_CHANGES - 2}`);
  });

  it("names the values an edit changed", () => {
    expect(changedFields(change("c1"))).toEqual(["validTo"]);
    expect(changedFields(change("c1", { after: snapshot({ levelId: "L2", startDate: "2026-02-01" }) }))).toEqual(["level", "validFrom"]);
    expect(changedFields(change("c1", { kind: "assigned", before: null }))).toEqual([]);
  });

  it("lets only the newest change of an assignment be undone", () => {
    const older = change("older");
    const newer = change("newer");
    const other = change("other", { personId: "p2" });
    const changes = [newer, other, older];
    expect(canUndo(newer, changes)).toBe(true);
    expect(canUndo(older, changes)).toBe(false);
    expect(canUndo(other, changes)).toBe(true);
  });

  it("makes the change before an undone one undoable again, but not the undone one", () => {
    const changes = markUndone([change("newer"), change("older")], "newer");
    expect(canUndo(changes[0], changes)).toBe(false);
    expect(canUndo(changes[1], changes)).toBe(true);
  });

  it("points the entries of a person and skill to the assignment that an undo created", () => {
    const removed = change("removed", { kind: "removed", after: null });
    const changes = withNewAssignment([removed, change("edit"), change("other", { personId: "p2" })], removed, "a2");
    expect(changes.map((c) => c.assignmentId)).toEqual(["a2", "a2", "a1"]);
  });
});
