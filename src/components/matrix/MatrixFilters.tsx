"use client";

import { Button, Icon, Input, Label, MultiComboBox, MultiComboBoxItem, Switch } from "@ui5/webcomponents-react";
import { CELL_FILTERS, type CellFilter } from "@/lib/domain/matrix";
import type { Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Translate } from "@/lib/i18n/translate";
import styles from "./SkillMatrix.module.css";

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
  showSystemUsers: boolean;
  onSearch: (search: string) => void;
  onSkillIds: (ids: string[]) => void;
  onLevels: (levels: string[]) => void;
  onStatusFilters: (filters: CellFilter[]) => void;
  onShowSystemUsers: (shown: boolean) => void;
}

export function MatrixFilters(props: Props) {
  const { skills, levelNames, search, skillIds, levels, statusFilters, showSystemUsers } = props;
  const { onSearch, onSkillIds, onLevels, onStatusFilters, onShowSystemUsers } = props;
  const { t } = useI18n();
  return (
    <>
      <div className={styles.filters}>
        <Input
          className={styles.search}
          placeholder={t("filter.searchPerson")}
          accessibleName={t("filter.searchPerson")}
          showClearIcon
          icon={<Icon name="search" />}
          value={search}
          onInput={(event) => onSearch(event.target.value)}
        />
        <MultiComboBox
          className={styles.skills}
          placeholder={t("filter.bySkills")}
          accessibleName={t("filter.bySkills")}
          title={t("filter.bySkillsHelp")}
          onSelectionChange={(event) => onSkillIds(event.detail.items.map((item) => item.dataset.id ?? ""))}
        >
          {skills.map((skill) => (
            <MultiComboBoxItem key={skill.id} text={skill.name} data-id={skill.id} selected={skillIds.includes(skill.id)} />
          ))}
        </MultiComboBox>
        {levelNames.length > 0 && (
          <MultiComboBox
            className={styles.levels}
            placeholder={t("filter.byLevel")}
            accessibleName={t("filter.byLevel")}
            onSelectionChange={(event) => onLevels(event.detail.items.map((item) => item.text ?? ""))}
          >
            {levelNames.map((name) => (
              <MultiComboBoxItem key={name} text={name} selected={levels.includes(name)} />
            ))}
          </MultiComboBox>
        )}
        <span className={styles.inline}>
          <Switch
            id="system-users"
            tooltip={t("filter.systemUsersHelp")}
            accessibleNameRef="system-users-label"
            checked={showSystemUsers}
            onChange={(event) => onShowSystemUsers(event.target.checked)}
          />
          <Label id="system-users-label" for="system-users" onClick={() => onShowSystemUsers(!showSystemUsers)}>
            {t("filter.showSystemUsers")}
          </Label>
        </span>
      </div>

      <div className={styles.inline} role="group" aria-label={t("filter.showOnlyGroup")}>
        <Label>{t("filter.showOnly")}</Label>
        {CELL_FILTERS.map((filter) => {
          const active = statusFilters.includes(filter);
          const label = filterLabel(filter, t);
          return (
            <Button
              key={filter}
              tooltip={t(`filterHelp.${filter}`)}
              design={active ? "Emphasized" : "Default"}
              icon={active ? "accept" : undefined}
              accessibleName={t(active ? "filter.on" : "filter.off", { label })}
              onClick={() => onStatusFilters(active ? statusFilters.filter((other) => other !== filter) : [...statusFilters, filter])}
            >
              {label}
            </Button>
          );
        })}
        {statusFilters.length > 0 && (
          <Button design="Transparent" icon="clear-filter" onClick={() => onStatusFilters([])}>
            {t("filter.clear")}
          </Button>
        )}
      </div>
    </>
  );
}
