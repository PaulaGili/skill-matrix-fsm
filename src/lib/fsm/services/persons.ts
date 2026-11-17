import { fsmQuery } from "@/lib/fsm/client";
import type { FsmPerson } from "@/lib/fsm/types";
import type { Person } from "./model";

const ACTIVE_PERSONS = `
  SELECT p.id, p.firstName, p.lastName, p.jobTitle, p.type
  FROM Person p
  WHERE p.inactive = false
  ORDER BY p.lastName, p.firstName`;

// The Query API can return the same row twice (SAP KBA 3520803).
export function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()];
}

export function toPerson(p: FsmPerson): Person {
  const name = [p.lastName?.trim(), p.firstName?.trim()].filter(Boolean).join(", ");
  return {
    id: p.id,
    displayName: name || `(no name) ${p.id.slice(0, 6)}`,
    jobTitle: p.jobTitle?.trim() || null,
    isTechnician: p.type === "EMPLOYEE" && name !== "",
  };
}

// Query rows come wrapped in their alias: { p: {...} }.
export async function listActivePersons(): Promise<Person[]> {
  const rows = await fsmQuery<{ p: FsmPerson }>(ACTIVE_PERSONS, ["Person"]);
  const persons = dedupeById(rows.map((row) => row.p)).map(toPerson);
  // FSM returns the two records of a person in no fixed order. Show the technician first.
  const position = new Map<string, number>();
  persons.forEach((person, index) => position.has(person.displayName) || position.set(person.displayName, index));
  return persons.sort(
    (a, b) => position.get(a.displayName)! - position.get(b.displayName)! || Number(b.isTechnician) - Number(a.isTechnician) || a.id.localeCompare(b.id),
  );
}
