"use client";

import { Button, Icon, Input, Label, MultiComboBox, MultiComboBoxItem, Switch } from "@ui5/webcomponents-react";
import { CELL_FILTERS, type CellFilter } from "@/lib/domain/matrix";
import type { Skill } from "@/lib/fsm/services/model";
import styles from "./SkillMatrix.module.css";

const FILTER_LABELS: Record<CellFilter, string> = {
  valid: "Valid",
  expiring: "Expiring soon",
  expired: "Expired",
  notYetValid: "Not yet valid",
  noCertificate: "No certificate",
};
const FILTER_HELP: Record<CellFilter, string> = {
  valid: "Persons with a valid assignment",
  expiring: "Persons with an assignment that ends within 30 days",
  expired: "Persons with an assignment whose end date is in the past",
  notYetValid: "Persons with an assignment that starts in the future",
  noCertificate: "Persons with an assignment that has no certificate attached",
};
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
  return (
    <>
      <div className={styles.filters}>
        <Input
          className={styles.search}
          placeholder="Search person"
          accessibleName="Search person"
          showClearIcon
          icon={<Icon name="search" />}
          value={search}
          onInput={(event) => onSearch(event.target.value)}
        />
        <MultiComboBox
          className={styles.skills}
          placeholder="Filter by skills"
          accessibleName="Filter by skills"
          title="Shows the persons with all the selected skills. Valid and Expiring soon are switched on with the first skill."
          onSelectionChange={(event) => onSkillIds(event.detail.items.map((item) => item.dataset.id ?? ""))}
        >
          {skills.map((skill) => (
            <MultiComboBoxItem key={skill.id} text={skill.name} data-id={skill.id} selected={skillIds.includes(skill.id)} />
          ))}
        </MultiComboBox>
        {levelNames.length > 0 && (
          <MultiComboBox
            className={styles.levels}
            placeholder="Filter by level"
            accessibleName="Filter by level"
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
            tooltip="Also show the login accounts of the same persons"
            accessibleNameRef="system-users-label"
            checked={showSystemUsers}
            onChange={(event) => onShowSystemUsers(event.target.checked)}
          />
          <Label id="system-users-label" for="system-users" onClick={() => onShowSystemUsers(!showSystemUsers)}>
            Show system users
          </Label>
        </span>
      </div>

      <div className={styles.inline} role="group" aria-label="Show only persons with">
        <Label>Show only:</Label>
        {CELL_FILTERS.map((filter) => {
          const active = statusFilters.includes(filter);
          const label = FILTER_LABELS[filter];
          return (
            <Button
              key={filter}
              tooltip={FILTER_HELP[filter]}
              design={active ? "Emphasized" : "Default"}
              icon={active ? "accept" : undefined}
              accessibleName={`${label}, ${active ? "filter on" : "filter off"}`}
              onClick={() => onStatusFilters(active ? statusFilters.filter((other) => other !== filter) : [...statusFilters, filter])}
            >
              {label}
            </Button>
          );
        })}
        {statusFilters.length > 0 && (
          <Button design="Transparent" icon="clear-filter" onClick={() => onStatusFilters([])}>
            Clear
          </Button>
        )}
      </div>
    </>
  );
}
