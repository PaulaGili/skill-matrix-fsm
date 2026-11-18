import { useMemo } from "react";
import { buildCells, filterPersons, filterSkills, levelNamesOf, personPasses, skillsWithMatches, type CellFilter } from "@/lib/domain/matrix";
import { todayIso } from "@/lib/domain/status";
import type { MatrixData } from "@/lib/fsm/services/matrix";

interface FilterState {
  search: string;
  pickedSkillIds: string[];
  showSystemUsers: boolean;
  statusFilters: CellFilter[];
  levels: string[];
}

// What the matrix shows for the loaded data and the filters: the cells, the rows and the
// columns. The rules themselves are in lib/domain/matrix.
export function useMatrixView(data: MatrixData | null, state: FilterState) {
  const today = todayIso();

  // A selected skill that was deleted in the meantime no longer filters.
  const skillIds = useMemo(() => state.pickedSkillIds.filter((id) => data?.skills.some((skill) => skill.id === id)), [state.pickedSkillIds, data]);

  const cells = useMemo(
    () => buildCells(data?.assignments ?? [], new Set(data?.certificates.map((certificate) => certificate.assignmentId)), today),
    [data, today],
  );
  const selectedSkills = useMemo(() => filterSkills(data?.skills ?? [], skillIds), [data, skillIds]);

  const levelNames = useMemo(() => levelNamesOf(data?.assignments ?? []), [data]);

  const filters = useMemo(() => ({ statuses: state.statusFilters, levels: state.levels }), [state.statusFilters, state.levels]);

  const searched = useMemo(() => filterPersons(data?.persons ?? [], state.search, state.showSystemUsers), [data, state.search, state.showSystemUsers]);

  const persons = useMemo(() => {
    const allSkillIds = (data?.skills ?? []).map((skill) => skill.id);
    return searched.filter((person) => personPasses(person.id, skillIds, allSkillIds, cells, filters));
  }, [data, searched, skillIds, cells, filters]);

  // The columns: the selected skills, or with a status or level filter on, only the skills
  // in which a shown person has a matching cell.
  const skills = useMemo(() => {
    if (skillIds.length > 0) return selectedSkills;
    const personIds = persons.map((person) => person.id);
    return skillsWithMatches(selectedSkills, personIds, cells, filters);
  }, [selectedSkills, skillIds, persons, cells, filters]);

  return { skillIds, cells, levelNames, filters, persons, skills };
}
