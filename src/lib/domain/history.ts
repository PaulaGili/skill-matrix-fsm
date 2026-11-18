// A change the user made to an assignment, as it is kept in the history of this browser.
export interface Snapshot {
  levelId: string | null;
  levelName: string | null;
  startDate: string | null;
  endDate: string | null;
}

export type ChangeKind = "assigned" | "edited" | "removed";

export interface Change {
  id: string;
  at: string; // ISO timestamp
  kind: ChangeKind;
  skillId: string;
  skillName: string;
  personId: string;
  personName: string;
  assignmentId: string;
  before: Snapshot | null; // null when the assignment was new
  after: Snapshot | null; // null when it was removed
  lostCertificates: number; // files deleted with a removed assignment, they cannot come back
  undone: boolean;
}

export const MAX_CHANGES = 50;

// Newest first, and never more than MAX_CHANGES.
export function withChange(changes: Change[], change: Change): Change[] {
  return [change, ...changes].slice(0, MAX_CHANGES);
}

export function markUndone(changes: Change[], id: string): Change[] {
  return changes.map((change) => (change.id === id ? { ...change, undone: true } : change));
}

// After a removal was undone, the entries of that person and skill point to the new assignment.
export function withNewAssignment(changes: Change[], undone: Change, assignmentId: string): Change[] {
  const same = (change: Change) => change.personId === undone.personId && change.skillId === undone.skillId;
  return changes.map((change) => (same(change) ? { ...change, assignmentId } : change));
}

// Which values an edit changed, for the description in the list.
export function changedFields(change: Change): ("level" | "validFrom" | "validTo")[] {
  const { before, after } = change;
  if (!before || !after) return [];
  return [
    ...(before.levelId !== after.levelId ? (["level"] as const) : []),
    ...(before.startDate !== after.startDate ? (["validFrom"] as const) : []),
    ...(before.endDate !== after.endDate ? (["validTo"] as const) : []),
  ];
}

// Only the newest change of an assignment that has not been undone can be undone. An older
// one would write values over a later change.
export function canUndo(change: Change, changes: Change[]): boolean {
  if (change.undone) return false;
  const newest = changes.find((other) => !other.undone && other.personId === change.personId && other.skillId === change.skillId);
  return newest?.id === change.id;
}
