"use client";

import { FilterGroupItem, Option, Select } from "@ui5/webcomponents-react";
import shell from "@/components/common/AppShell.module.css";
import { PageFilters, pickFilter, searchFilter } from "@/components/common/Filters";
import type { Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";

// 0 stands for what has already expired.
export const EXPIRED = 0;
const WINDOWS = [30, 60, 90, 180, EXPIRED];

export interface ExpiryFilter {
  days: number;
  search: string;
  skillIds: string[];
  levels: string[];
  certificate: string[]; // "with", "without", or both for no filter
}

export const NO_FILTER: ExpiryFilter = { days: WINDOWS[0], search: "", skillIds: [], levels: [], certificate: [] };

interface Props {
  value: ExpiryFilter;
  skills: Skill[];
  levelNames: string[];
  onChange: (value: ExpiryFilter) => void;
}

// The period and the filters of the expiry page. Clear keeps the period.
export function ExpiryFilters({ value, skills, levelNames, onChange }: Props) {
  const { t } = useI18n();
  return (
    <PageFilters
      active={value.search !== "" || value.skillIds.length > 0 || value.levels.length > 0 || value.certificate.length > 0}
      onClear={() => onChange({ ...NO_FILTER, days: value.days })}
    >
      <FilterGroupItem filterKey="period" label={t("expiry.period")} className={shell.filterItem}>
        <Select
          id="expiry-window"
          accessibleName={t("expiry.period")}
          onChange={(event) => onChange({ ...value, days: Number(event.detail.selectedOption.dataset.days) })}
        >
          {WINDOWS.map((window) => (
            <Option key={window} data-days={window} selected={window === value.days}>
              {window === EXPIRED ? t("expiry.expired") : t("expiry.days", { count: window })}
            </Option>
          ))}
        </Select>
      </FilterGroupItem>
      {searchFilter({
        filterKey: "person",
        label: t("field.person"),
        placeholder: t("filter.searchPerson"),
        value: value.search,
        onChange: (search) => onChange({ ...value, search }),
      })}
      {pickFilter({
        filterKey: "skills",
        label: t("field.skill"),
        placeholder: t("filter.bySkills"),
        options: skills.map((skill) => ({ key: skill.id, text: skill.name })),
        selected: value.skillIds,
        onChange: (skillIds) => onChange({ ...value, skillIds }),
      })}
      {pickFilter({
        filterKey: "level",
        label: t("field.level"),
        placeholder: t("filter.byLevel"),
        options: levelNames.map((name) => ({ key: name, text: name })),
        selected: value.levels,
        onChange: (levels) => onChange({ ...value, levels }),
      })}
      {pickFilter({
        filterKey: "certificate",
        label: t("field.certificate"),
        placeholder: t("filter.byCertificate"),
        options: [
          { key: "with", text: t("filter.withCertificate") },
          { key: "without", text: t("filter.noCertificate") },
        ],
        selected: value.certificate,
        onChange: (certificate) => onChange({ ...value, certificate }),
      })}
    </PageFilters>
  );
}
