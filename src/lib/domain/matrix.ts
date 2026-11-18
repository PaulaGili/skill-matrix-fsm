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

// The level names that are in use, lowest level first.
export function levelNamesOf(assignments: { levelName: string | null; level: number | null }[]): string[] {
  const byName = new Map(assignments.filter((a) => a.levelName).map((a) => [a.levelName!, a.level ?? 0]));
  return [...byName.keys()].sort((a, b) => byName.get(a)! - byName.get(b)!);
}

// No selection means all skills.
export function filterSkills<S extends { id: string }>(skills: S[], selectedIds: string[]): S[] {
  return selectedIds.length === 0 ? skills : skills.filter((skill) => selectedIds.includes(skill.id));
}

// The skills in the order the user dragged the columns into. A skill that is not in the
// stored order yet goes after the others, as the table shows it.
export function inColumnOrder<S extends { id: string }>(skills: S[], columnOrder: string[]): S[] {
  const position = (skill: S, index: number) => (columnOrder.includes(skill.id) ? columnOrder.indexOf(skill.id) : columnOrder.length + index);
  return skills
    .map((skill, index) => ({ skill, position: position(skill, index) }))
    .sort((a, b) => a.position - b.position)
    .map(({ skill }) => skill);
}

export function cellKey(personId: string, skillId: string): string {
  return `${personId}|${skillId}`;
}

// The matrix shows one assignment per person and skill. FSM allows several, so the one that
// is valid today wins, and among equals the one that stays valid longest.
export function indexAssignments<A extends AssignmentLike>(assignments: A[], today: string): Map<string, A> {
  const end = (a: A) => a.endDate ?? OPEN_END_DATE;
  const current = (a: A) => (a.startDate ?? "") <= today && end(a) >= today;
  const byCell = new Map<string, A>();
  for (const assignment of assignments) {
    const key = cellKey(assignment.personId, assignment.skillId);
    const shown = byCell.get(key);
    const better = !shown || (current(assignment) !== current(shown) ? current(assignment) : end(assignment) > end(shown));
    if (better) byCell.set(key, assignment);
  }
  return byCell;
}

export function buildCells<A extends AssignmentLike>(assignments: A[], assignmentsWithCertificate: Set<string>, today: string): Map<string, Cell<A>> {
  const cells = new Map<string, Cell<A>>();
  for (const [key, assignment] of indexAssignments(assignments, today)) {
    cells.set(key, { assignment, status: assignmentStatus(assignment, today), hasCertificate: assignmentsWithCertificate.has(assignment.id) });
  }
  return cells;
}

// In the order the statuses are listed in the assignment.
export const CELL_FILTERS = ["valid", "expiring", "expired", "notYetValid", "noCertificate"] as const;
export type CellFilter = (typeof CELL_FILTERS)[number];

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

// Sorting a skill column puts the problems first and the persons without the skill last.
const SORT_ORDER: AssignmentStatus[] = ["expired", "expiring", "notYetValid", "valid", "unassigned"];

export function statusRank(status: AssignmentStatus): number {
  return SORT_ORDER.indexOf(status);
}

export function sortRank(cell: Cell<AssignmentLike> | undefined): number {
  return statusRank(cell?.status ?? "unassigned");
}
