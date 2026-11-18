import type { Validity } from "./status";

// Retiring a skill ends every assignment that is valid today and keeps its certificates.
// Assignments that start after today were never valid and are removed. Assignments that
// already ended are left alone.
export function splitForRetire<A extends Validity>(assignments: A[], today: string): { toEnd: A[]; toRemove: A[] } {
  const toRemove = assignments.filter((a) => a.startDate !== null && a.startDate > today);
  const toEnd = assignments.filter((a) => !toRemove.includes(a) && (a.endDate === null || a.endDate >= today));
  return { toEnd, toRemove };
}
