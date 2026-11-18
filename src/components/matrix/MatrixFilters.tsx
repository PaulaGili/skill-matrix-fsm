"use client";

import { CELL_FILTERS, type CellFilter } from "@/lib/domain/matrix";
import { PageFilters, pickFilter, searchFilter } from "@/components/common/Filters";
import type { Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Translate } from "@/lib/i18n/translate";

// The status filters are named like the statuses.
export function filterLabel(filter: CellFilter, t: Translate): string {
  return filter === "noCertificate" ? t("filter.noCertificate") : t(`status.${filter}`);
}

interface Props {
  skills: Skill[];
  levelNames: string[];
  search: string;
  skillIds: string[];
  levels: string[];
  statusFilters: CellFilter[];
  onSearch: (search: string) => void;
  onSkillIds: (ids: string[]) => void;
  onLevels: (levels: string[]) => void;
  onStatusFilters: (filters: CellFilter[]) => void;
  onClearAll: () => void;
}

export function MatrixFilters(props: Props) {
  const { skills, levelNames, search, skillIds, levels, statusFilters, onSearch, onSkillIds, onLevels, onStatusFilters, onClearAll } = props;
  const anyFilter = search !== "" || skillIds.length > 0 || levels.length > 0 || statusFilters.length > 0;
  const { t } = useI18n();
  const names = (list: string[]) => list.map((name) => ({ key: name, text: name }));
  return (
    <PageFilters active={anyFilter} onClear={onClearAll}>
      {searchFilter({ filterKey: "person", label: t("field.person"), placeholder: t("filter.searchPerson"), value: search, onChange: onSearch })}
      {pickFilter({
        filterKey: "skills",
        label: t("field.skill"),
        placeholder: t("filter.bySkills"),
        help: t("filter.bySkillsHelp"),
        options: skills.map((skill) => ({ key: skill.id, text: skill.name })),
        selected: skillIds,
        onChange: onSkillIds,
      })}
      {pickFilter({
        filterKey: "level",
        label: t("field.level"),
        placeholder: t("filter.byLevel"),
        options: names(levelNames),
        selected: levels,
        onChange: onLevels,
      })}
      {pickFilter({
        filterKey: "status",
        label: t("field.status"),
        placeholder: t("filter.byStatus"),
        options: CELL_FILTERS.map((filter) => ({ key: filter, text: filterLabel(filter, t) })),
        selected: statusFilters,
        onChange: (keys) => onStatusFilters(keys as CellFilter[]),
      })}
    </PageFilters>
  );
}
