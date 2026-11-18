"use client";

import { useMemo } from "react";
import { AnalyticalTable, AnalyticalTableHooks, Link, type AnalyticalTableCellInstance, type AnalyticalTableColumnDefinition } from "@ui5/webcomponents-react";
import { cellKey, cellPasses, type Cell, type CellFilter } from "@/lib/domain/matrix";
import type { Assignment, Person, Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { MatrixCell } from "./MatrixCell";
import styles from "./SkillMatrix.module.css";

const VISIBLE_ROWS = 15;
// Keeps the person column in place while the skills scroll sideways. Despite its name this
// is a table plugin factory, not a React hook, so it is created once outside the component.
const { useStickyColumns: stickyColumns } = AnalyticalTableHooks;
const TABLE_HOOKS = [stickyColumns()];

interface Props {
  persons: Person[]; // filtered and sorted
  skills: Skill[]; // the columns to show
  cells: Map<string, Cell<Assignment>>;
  filters: { statuses: CellFilter[]; levels: string[] };
  loading: boolean;
  columnOrder: string[];
  onMoveColumn: (draggedId: string, targetId: string) => void;
  onPerson: (person: Person) => void;
  onCell: (person: Person, skill: Skill) => void;
}

// The table of the matrix: one row per person, one column per skill, the person column pinned.
export function MatrixTable({ persons, skills, cells, filters, loading, columnOrder, onMoveColumn, onPerson, onCell }: Props) {
  const { t } = useI18n();
  const columns = useMemo<AnalyticalTableColumnDefinition[]>(
    () => [
      {
        Header: t("field.person"),
        id: "person",
        accessor: "displayName",
        sticky: "start",
        disableSticky: true,
        disableDragAndDrop: true,
        width: 208,
        vAlign: "Middle",
        Cell: ({ row }: AnalyticalTableCellInstance) => {
          const person = row.original as Person;
          return (
            <span className={styles.person}>
              <Link accessibleRole="Button" accessibleName={t("person.openLabel", { name: person.displayName })} onClick={() => onPerson(person)}>
                {person.displayName}
              </Link>
              {!person.isTechnician && <span className={styles.detail}>{t("matrix.systemUser")}</span>}
            </span>
          );
        },
      },
      ...skills.map((skill): AnalyticalTableColumnDefinition => ({
        Header: skill.name,
        id: skill.id,
        accessor: (person) => cellKey(person.id, skill.id),
        disableSticky: true,
        minWidth: 162,
        hAlign: "Center",
        vAlign: "Middle",
        Cell: ({ row }: AnalyticalTableCellInstance) => {
          const person = row.original as Person;
          const cell = cells.get(cellKey(person.id, skill.id));
          return (
            <MatrixCell
              cell={cell}
              filteredOut={cell !== undefined && !cellPasses(cell, filters)}
              label={`${person.displayName}, ${skill.name}`}
              onSelect={() => onCell(person, skill)}
            />
          );
        },
      })),
    ],
    [skills, cells, filters, t, onPerson, onCell],
  );

  return (
    <AnalyticalTable
      columns={columns}
      data={persons}
      tableHooks={TABLE_HOOKS}
      loading={loading}
      visibleRows={VISIBLE_ROWS}
      minRows={1}
      rowHeight={52}
      sortable={false}
      columnOrder={columnOrder}
      onColumnsReorder={(event) => {
        // The event is the browser's drop event with the table's details added. The dragged
        // and the target column are read from it, as the details do not name the target.
        // The browser test for dragging guards this against a change in the table library.
        const drop = event as unknown as DragEvent;
        onMoveColumn(drop.dataTransfer?.getData("text") ?? "", (drop.currentTarget as HTMLElement).dataset.columnId ?? "");
      }}
      noDataText={t("matrix.noPersons")}
    />
  );
}
