import { OPEN_END_DATE, assignmentStatus, type AssignmentStatus, type Validity } from "./status";

interface AssignmentLike extends Validity {
  id: string;
  personId: string;
  skillId: string;
  levelName: string | null;
}

export interface Cell<A> {
  assignment: A;
  status: AssignmentStatus;
  hasCertificate: boolean;
}

export type CellFilter = "expired" | "expiring" | "notYetValid" | "valid" | "noCertificate";

// The cell filters of the matrix. An empty list means "any".
export interface MatrixFilters {
  statuses: CellFilter[];
  levels: string[]; // level names, e.g. "Expert"
}

// Technicians are shown by default. System users (the ERPUSER twin of every employee and
// technical persons without a name) only appear when asked for. Every word of the search
// must appear in the name, so "marco bieri" finds "Bieri, Marco".
export function filterPersons<P extends { displayName: string; isTechnician: boolean }>(persons: P[], search: string, showSystemUsers: boolean): P[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  return persons.filter((person) => {
    const name = person.displayName.toLowerCase();
    return (showSystemUsers || person.isTechnician) && words.every((word) => name.includes(word));
  });
}

// No selection means all skills.
export function filterSkills<S extends { id: string }>(skills: S[], selectedIds: string[]): S[] {
  return selectedIds.length === 0 ? skills : skills.filter((skill) => selectedIds.includes(skill.id));
}

export function cellKey(personId: string, skillId: string): string {
  return `${personId}|${skillId}`;
}

// The matrix shows one assignment per person and skill. FSM allows several, so the one
// that stays valid longest wins.
export function indexAssignments<A extends AssignmentLike>(assignments: A[]): Map<string, A> {
  const byCell = new Map<string, A>();
  for (const assignment of assignments) {
    const key = cellKey(assignment.personId, assignment.skillId);
    const current = byCell.get(key);
    if (!current || (assignment.endDate ?? OPEN_END_DATE) > (current.endDate ?? OPEN_END_DATE)) byCell.set(key, assignment);
  }
  return byCell;
}

export function buildCells<A extends AssignmentLike>(assignments: A[], assignmentsWithCertificate: Set<string>, today: string): Map<string, Cell<A>> {
  const cells = new Map<string, Cell<A>>();
  for (const [key, assignment] of indexAssignments(assignments)) {
    cells.set(key, { assignment, status: assignmentStatus(assignment, today), hasCertificate: assignmentsWithCertificate.has(assignment.id) });
  }
  return cells;
}

// In the order the statuses are listed in the assignment.
export const CELL_FILTERS: CellFilter[] = ["valid", "expiring", "expired", "notYetValid", "noCertificate"];

export function cellMatches(cell: Cell<AssignmentLike>, filter: CellFilter): boolean {
  return filter === "noCertificate" ? !cell.hasCertificate : cell.status === filter;
}

// A skill someone can be sent out with today. The matrix switches these two on when a
// skill is selected, so the default is visible and can be changed.
export const HELD_TODAY: CellFilter[] = ["valid", "expiring"];

// Does a cell pass the active filters? The status filters are alternatives ("expired or
// expiring soon") and so are the levels. "No certificate" is a separate condition. All three
// must hold in the same cell.
export function cellPasses(cell: Cell<AssignmentLike>, filters: MatrixFilters): boolean {
  const statuses: string[] = filters.statuses.filter((filter) => filter !== "noCertificate");
  if (statuses.length > 0 && !statuses.includes(cell.status)) return false;
  if (filters.levels.length > 0 && !filters.levels.includes(cell.assignment.levelName ?? "")) return false;
  return !filters.statuses.includes("noCertificate") || !cell.hasCertificate;
}

// Without a status or level filter everyone stays. Otherwise a person needs a passing cell
// in every selected skill, or in any skill when none is selected.
export function personPasses(
  personId: string,
  selectedSkillIds: string[],
  allSkillIds: string[],
  cells: Map<string, Cell<AssignmentLike>>,
  filters: MatrixFilters,
): boolean {
  if (filters.statuses.length === 0 && filters.levels.length === 0) return true;
  const passes = (skillId: string) => {
    const cell = cells.get(cellKey(personId, skillId));
    return cell !== undefined && cellPasses(cell, filters);
  };
  return selectedSkillIds.length > 0 ? selectedSkillIds.every(passes) : allSkillIds.some(passes);
}

// With a status or level filter on, a column only helps if one of the shown persons has a
// passing cell in it. Skills the user selected always stay.
export function skillsWithMatches<S extends { id: string }>(
  skills: S[],
  personIds: string[],
  cells: Map<string, Cell<AssignmentLike>>,
  filters: MatrixFilters,
): S[] {
  if (filters.statuses.length === 0 && filters.levels.length === 0) return skills;
  return skills.filter((skill) =>
    personIds.some((personId) => {
      const cell = cells.get(cellKey(personId, skill.id));
      return cell !== undefined && cellPasses(cell, filters);
    }),
  );
}
