// The history lives in this browser only: FSM offers no change log to the app and the app
// has no database. It is kept per candidate namespace. If storage is not available, the
// history is simply empty.
import { CANDIDATE_ID } from "@/lib/candidate";
import { markUndone, withChange, type Change } from "@/lib/domain/history";

const KEY = `history:${CANDIDATE_ID}`;

export function loadChanges(): Change[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(changes: Change[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(changes));
  } catch {}
}

export function recordChange(change: Omit<Change, "id" | "at" | "undone">): void {
  save(withChange(loadChanges(), { ...change, id: crypto.randomUUID(), at: new Date().toISOString(), undone: false }));
}

export function recordUndone(id: string): void {
  save(markUndone(loadChanges(), id));
}
