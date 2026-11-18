"use client";

import { FilterBar, FilterGroupItem, Icon, Input, MultiComboBox, MultiComboBoxItem } from "@ui5/webcomponents-react";
import { CELL_FILTERS, type CellFilter } from "@/lib/domain/matrix";
import shell from "@/components/common/AppShell.module.css";
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
  return (
    <FilterBar
      className={shell.filterBar}
      filterContainerWidth="13rem"
      hideFilterConfiguration
      hideToggleFiltersButton
      hideToolbar
      showClearOnFB={anyFilter}
      onClear={onClearAll}
    >
      <FilterGroupItem filterKey="person" label={t("field.person")}>
        <Input
          placeholder={t("filter.searchPerson")}
          accessibleName={t("filter.searchPerson")}
          showClearIcon
          icon={<Icon name="search" />}
          value={search}
          onInput={(event) => onSearch(event.target.value)}
        />
      </FilterGroupItem>
      <FilterGroupItem filterKey="skills" label={t("field.skill")}>
        <MultiComboBox
          placeholder={t("filter.bySkills")}
          accessibleName={t("filter.bySkills")}
          title={t("filter.bySkillsHelp")}
          onSelectionChange={(event) => onSkillIds(event.detail.items.map((item) => item.dataset.id ?? ""))}
        >
          {skills.map((skill) => (
            <MultiComboBoxItem key={skill.id} text={skill.name} data-id={skill.id} selected={skillIds.includes(skill.id)} />
          ))}
        </MultiComboBox>
      </FilterGroupItem>
      <FilterGroupItem filterKey="level" label={t("field.level")} hiddenInFilterBar={levelNames.length === 0}>
        <MultiComboBox
          placeholder={t("filter.byLevel")}
          accessibleName={t("filter.byLevel")}
          onSelectionChange={(event) => onLevels(event.detail.items.map((item) => item.text ?? ""))}
        >
          {levelNames.map((name) => (
            <MultiComboBoxItem key={name} text={name} selected={levels.includes(name)} />
          ))}
        </MultiComboBox>
      </FilterGroupItem>
      <FilterGroupItem filterKey="status" label={t("field.status")}>
        <MultiComboBox
          placeholder={t("filter.byStatus")}
          accessibleName={t("filter.byStatus")}
          onSelectionChange={(event) => onStatusFilters(event.detail.items.map((item) => item.dataset.filter as CellFilter))}
        >
          {CELL_FILTERS.map((filter) => (
            <MultiComboBoxItem key={filter} text={filterLabel(filter, t)} data-filter={filter} selected={statusFilters.includes(filter)} />
          ))}
        </MultiComboBox>
      </FilterGroupItem>
    </FilterBar>
  );
}
