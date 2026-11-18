import { CELL_FILTERS, HELD_TODAY, type CellFilter } from "./matrix";

// What the AI returns for a question about the matrix: filter values, never an answer.
export interface QuestionAnswer {
  understood: boolean;
  personSearch: string | null;
  skills: string[];
  statuses: string[];
  levels: string[];
  unknown: string[]; // skills or levels the question names that are not in the lists
}

export interface QuestionFilters {
  search: string;
  skillIds: string[];
  statuses: CellFilter[];
  levels: string[];
}

export interface QuestionResult {
  filters: QuestionFilters | null; // null when nothing usable is left
  notFound: string[]; // names from the question that do not exist
}

// The AI proposes filter values. This keeps only skills, levels and statuses that exist, so
// a made-up name cannot filter anything. The matrix then computes the result as usual.
export function toFilters(answer: QuestionAnswer, skills: { id: string; name: string }[], levelNames: string[]): QuestionResult {
  const notFound = [...answer.unknown];
  const pick = <T>(names: string[], find: (name: string) => T | undefined): T[] =>
    names.flatMap((name) => {
      const found = find(name.trim().toLowerCase());
      if (found === undefined) notFound.push(name);
      return found === undefined ? [] : [found];
    });

  const skillIds = pick(answer.skills, (name) => skills.find((skill) => skill.name.toLowerCase() === name)?.id);
  const levels = pick(answer.levels, (name) => levelNames.find((level) => level.toLowerCase() === name));
  let statuses = CELL_FILTERS.filter((filter) => answer.statuses.includes(filter));
  // The same default as selecting a skill by hand: who holds it today.
  if (skillIds.length > 0 && statuses.length === 0) statuses = HELD_TODAY;

  const search = answer.personSearch?.trim() ?? "";
  const nothing = skillIds.length === 0 && statuses.length === 0 && levels.length === 0 && !search;
  // A question about something that does not exist is not answered with the filters that are left.
  const filters = !answer.understood || nothing || notFound.length > 0 ? null : { search, skillIds, statuses, levels };
  return { filters, notFound };
}
