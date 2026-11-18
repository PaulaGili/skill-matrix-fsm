// The history lives in this browser only: FSM offers no change log to the app and the app
// has no database. It is kept per candidate namespace. If storage is not available, the
// history is simply empty.
import { CANDIDATE_ID } from "@/lib/candidate";
import { markUndone, withChange, withNewAssignment, type Change } from "@/lib/domain/history";
import type { Assignment } from "@/lib/fsm/services/model";
import { readStoredJson, store } from "@/lib/storage";

const KEY = `history:${CANDIDATE_ID}`;

export function loadChanges(): Change[] {
  const stored = readStoredJson(KEY);
  return Array.isArray(stored) ? stored : [];
}

const save = (changes: Change[]) => store(KEY, JSON.stringify(changes));

// The history is a convenience. Recording must never fail a save that FSM has accepted.
export function recordChange(change: Omit<Change, "id" | "at" | "undone">): void {
  const at = new Date().toISOString();
  save(withChange(loadChanges(), { ...change, id: `${at}-${Math.random()}`, at, undone: false }));
}

export function recordAssigned(skillName: string, personName: string, assignment: Assignment): void {
  recordChange({
    kind: "assigned",
    skillId: assignment.skillId,
    skillName,
    personId: assignment.personId,
    personName,
    assignmentId: assignment.id,
    before: null,
    after: { levelId: assignment.levelId, levelName: assignment.levelName, startDate: assignment.startDate, endDate: assignment.endDate },
    lostCertificates: 0,
  });
}

// An undone removal creates the assignment again, with a new id that the older entries need.
export function recordUndone(change: Change, recreated: Assignment | null): void {
  const changes = markUndone(loadChanges(), change.id);
  save(recreated ? withNewAssignment(changes, change, recreated.id) : changes);
}
