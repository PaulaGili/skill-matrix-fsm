"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "@ui5/webcomponents-fiori/dist/illustrations/NoEntries.js";
import {
  AnalyticalTable,
  AnalyticalTableHooks,
  Button,
  IllustratedMessage,
  Label,
  Link,
  ObjectStatus,
  Switch,
  Title,
  type AnalyticalTableCellInstance,
  type AnalyticalTableColumnDefinition,
} from "@ui5/webcomponents-react";
import { AssignmentDialog } from "@/components/assignment/AssignmentDialog";
import { BulkAssignDialog } from "@/components/assignment/BulkAssignDialog";
import shell from "@/components/common/AppShell.module.css";
import { ImportDialog } from "./ImportDialog";
import { PersonDialog } from "./PersonDialog";
import { ExportButton } from "@/components/common/ExportDialog";
import { LoadError, Loading } from "@/components/common/LoadState";
import { useToast } from "@/components/common/useToast";
import { useAsyncData } from "@/hooks/useAsyncData";
import { isAiEnabled } from "@/lib/ai/client";
import {
  HELD_TODAY,
  buildCells,
  cellPasses,
  cellKey,
  filterPersons,
  filterSkills,
  inColumnOrder,
  personPasses,
  skillsWithMatches,
  sortRank,
  summarize,
  type CellFilter,
} from "@/lib/domain/matrix";
import { matrixTable } from "@/lib/domain/export";
import { todayIso } from "@/lib/domain/status";
import { loadMatrixData } from "@/lib/fsm/services/matrix";
import type { Person, Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { AskMatrix } from "./AskMatrix";
import { MatrixCell } from "./MatrixCell";
import { MatrixFilters } from "./MatrixFilters";
import styles from "./SkillMatrix.module.css";

const VISIBLE_ROWS = 15;
const SUMMARY = [
  { filter: "expired", state: "Negative" },
  { filter: "expiring", state: "Critical" },
  { filter: "noCertificate", state: "Information" },
] as const;

const COLUMN_ORDER_KEY = "matrix:columnOrder";
function loadColumnOrder(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(COLUMN_ORDER_KEY) ?? "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

// Keeps the person column in place while the skills scroll sideways. Despite its name this
// is a table plugin factory, not a React hook, so it is created once outside the component.
const { useStickyColumns: stickyColumns } = AnalyticalTableHooks;
const TABLE_HOOKS = [stickyColumns()];

export function SkillMatrix() {
  const router = useRouter();
  const { data, error, loading, reload } = useAsyncData(loadMatrixData);
  const [search, setSearch] = useState("");
  const [pickedSkillIds, setSkillIds] = useState<string[]>([]);
  const [showSystemUsers, setShowSystemUsers] = useState(false);
  const [statusFilters, setStatusFilters] = useState<CellFilter[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [selected, setSelected] = useState<{ person: Person; skill: Skill } | null>(null);
  const [assigningSeveral, setAssigningSeveral] = useState(false);
  const [importing, setImporting] = useState(false);
  const [shownPerson, setShownPerson] = useState<Person | null>(null);
  const { toastElement, showToast } = useToast();
  const aiEnabled = useAsyncData(isAiEnabled).data === true;
  const { t } = useI18n();
  const today = todayIso();

  // Selecting the first skill switches on Valid and Expiring soon: "who can do this today?".
  function selectSkills(ids: string[]) {
    if (pickedSkillIds.length === 0 && ids.length > 0 && statusFilters.length === 0) {
      setStatusFilters(HELD_TODAY);
      showToast(t("filter.heldTodayOn"));
    }
    setSkillIds(ids);
  }

  // A selected skill that was deleted in the meantime no longer filters.
  const skillIds = useMemo(() => pickedSkillIds.filter((id) => data?.skills.some((skill) => skill.id === id)), [pickedSkillIds, data]);

  const cells = useMemo(
    () => buildCells(data?.assignments ?? [], new Set(data?.certificates.map((certificate) => certificate.assignmentId)), today),
    [data, today],
  );
  const selectedSkills = useMemo(() => filterSkills(data?.skills ?? [], skillIds), [data, skillIds]);

  const levelNames = useMemo(() => {
    const byName = new Map((data?.assignments ?? []).filter((a) => a.levelName).map((a) => [a.levelName!, a.level ?? 0]));
    return [...byName.keys()].sort((a, b) => byName.get(a)! - byName.get(b)!);
  }, [data]);

  const filters = useMemo(() => ({ statuses: statusFilters, levels }), [statusFilters, levels]);

  // The order of the skill columns after dragging them, remembered in this browser.
  const [columnOrder, setColumnOrder] = useState<string[]>(loadColumnOrder);
  function saveColumnOrder(order: string[]) {
    setColumnOrder(order);
    try {
      localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(order));
    } catch {}
  }

  // The dragged skill takes the place of the one it is dropped on. The table's own result
  // is not used: dropped to the right it puts the column back where it was.
  function moveColumn(draggedId: string, droppedId: string) {
    const order = inColumnOrder(data?.skills ?? [], columnOrder).map((skill) => skill.id);
    const from = order.indexOf(draggedId);
    const to = order.indexOf(droppedId);
    if (from === -1 || to === -1) return;
    order.splice(to, 0, order.splice(from, 1)[0]);
    saveColumnOrder(order);
  }

  const searched = useMemo(() => filterPersons(data?.persons ?? [], search, showSystemUsers), [data, search, showSystemUsers]);

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

  const columns = useMemo<AnalyticalTableColumnDefinition[]>(
    () => [
      {
        Header: t("field.person"),
        id: "person",
        accessor: "displayName",
        sticky: "start",
        disableSticky: true,
        disableDragAndDrop: true,
        width: 260,
        vAlign: "Middle",
        Cell: ({ row }: AnalyticalTableCellInstance) => {
          const person = row.original as Person;
          return (
            <span className={styles.person}>
              <Link accessibleRole="Button" accessibleName={t("person.openLabel", { name: person.displayName })} onClick={() => setShownPerson(person)}>
                {person.displayName}
              </Link>
              <span className={styles.detail}>{person.isTechnician ? person.jobTitle : t("matrix.systemUser")}</span>
            </span>
          );
        },
      },
      ...skills.map((skill): AnalyticalTableColumnDefinition => ({
        Header: skill.name,
        id: skill.id,
        // Sorting a skill puts the problems first: expired, expiring soon, then the rest.
        accessor: (person) => sortRank(cells.get(cellKey(person.id, skill.id))),
        disableSticky: true,
        minWidth: 220,
        vAlign: "Middle",
        Cell: ({ row }: AnalyticalTableCellInstance) => {
          const person = row.original as Person;
          const cell = cells.get(cellKey(person.id, skill.id));
          return (
            <MatrixCell
              cell={cell}
              filteredOut={cell !== undefined && !cellPasses(cell, filters)}
              label={`${person.displayName}, ${skill.name}`}
              onSelect={() => setSelected({ person, skill })}
            />
          );
        },
      })),
    ],
    [skills, cells, filters, t],
  );

  // A coloured line at the start of the row: red when something of the shown skills has
  // expired, orange when something expires soon.
  const rowHighlight = useCallback(
    (person: Record<string, unknown>) => {
      const shown = skills.map((skill) => cells.get(cellKey(String(person.id), skill.id))).filter((cell) => cell && cellPasses(cell, filters));
      const statuses = shown.map((cell) => cell?.status);
      if (statuses.includes("expired")) return "Negative";
      return statuses.includes("expiring") ? "Critical" : "None";
    },
    [skills, cells, filters],
  );

  // The overview counts every technician, whatever is filtered at the moment.
  const summary = summarize(
    (data?.persons ?? []).filter((person) => person.isTechnician).map((person) => person.id),
    cells,
  );

  if (!data) return error ? <LoadError message={error} onRetry={reload} /> : <Loading />;

  // How many persons there are without any filter, to show "2 of 12".
  const total = filterPersons(data.persons, "", showSystemUsers).length;
  const selectedAssignment = selected ? cells.get(cellKey(selected.person.id, selected.skill.id))?.assignment : undefined;

  return (
    <>
      <div className={styles.header}>
        <Title level="H2">{t("nav.matrix")}</Title>
        <span className={styles.inline}>
          {data.skills.length > 0 && (
            <ExportButton name="skill-matrix" getRows={() => matrixTable(persons, inColumnOrder(skills, columnOrder), cells, filters, t)} onError={showToast} />
          )}
          {data.skills.length > 0 && (
            <Button design="Emphasized" icon="add-employee" tooltip={t("matrix.assignSeveralTooltip")} onClick={() => setAssigningSeveral(true)}>
              {t("matrix.assignSeveral")}
            </Button>
          )}
          {data.skills.length > 0 && (
            <Button design="Transparent" icon="upload" tooltip={t("import.tooltip")} onClick={() => setImporting(true)}>
              {t("import.button")}
            </Button>
          )}
          <Button design="Transparent" icon="refresh" tooltip={t("action.refreshTooltip")} disabled={loading} onClick={reload}>
            {t("action.refresh")}
          </Button>
        </span>
      </div>
      {error && <LoadError message={error} onRetry={reload} />}

      {data.skills.length === 0 ? (
        <IllustratedMessage name="NoEntries" titleText={t("matrix.noSkillsTitle")} subtitleText={t("matrix.noSkillsText")}>
          <Button onClick={() => router.push("/catalog")}>{t("matrix.openCatalog")}</Button>
        </IllustratedMessage>
      ) : (
        <div className={shell.panel}>
          {aiEnabled && (
            <AskMatrix
              skills={data.skills}
              levelNames={levelNames}
              onFilters={(asked) => {
                setSearch(asked.search);
                setSkillIds(asked.skillIds);
                setStatusFilters(asked.statuses);
                setLevels(asked.levels);
              }}
            />
          )}
          <MatrixFilters
            skills={data.skills}
            levelNames={levelNames}
            search={search}
            skillIds={skillIds}
            levels={levels}
            statusFilters={statusFilters}
            onSearch={setSearch}
            onSkillIds={selectSkills}
            onLevels={setLevels}
            onStatusFilters={setStatusFilters}
            onClearAll={() => {
              setSearch("");
              setSkillIds([]);
              setLevels([]);
              setStatusFilters([]);
            }}
          />

          <AnalyticalTable
            header={
              <div className={styles.summary}>
                <Title level="H5">
                  {persons.length === total ? t("matrix.persons", { count: total }) : t("matrix.personsOf", { count: persons.length, total })}
                </Title>
                <Label>{t("matrix.summaryLabel")}</Label>
                {SUMMARY.map(({ filter, state }) => (
                  <ObjectStatus
                    key={filter}
                    state={summary[filter] > 0 ? state : "None"}
                    interactive
                    title={t("matrix.summaryHelp")}
                    onClick={() => setStatusFilters([filter])}
                  >
                    {t(`matrix.summary.${filter}`, { count: summary[filter] })}
                  </ObjectStatus>
                ))}
                <span className={styles.spacer} />
                <span className={styles.inline}>
                  <Switch
                    id="system-users"
                    tooltip={t("filter.systemUsersHelp")}
                    accessibleNameRef="system-users-label"
                    checked={showSystemUsers}
                    onChange={(event) => setShowSystemUsers(event.target.checked)}
                  />
                  <Label id="system-users-label" for="system-users" onClick={() => setShowSystemUsers(!showSystemUsers)}>
                    {t("filter.showSystemUsers")}
                  </Label>
                </span>
              </div>
            }
            columns={columns}
            data={persons}
            tableHooks={TABLE_HOOKS}
            loading={loading}
            visibleRows={VISIBLE_ROWS}
            minRows={1}
            rowHeight={52}
            sortable
            withRowHighlight
            highlightField={rowHighlight}
            columnOrder={columnOrder}
            onColumnsReorder={(event) => {
              // The event is the browser's drop event with the table's details added. The dragged
              // and the target column are read from it, as the details do not name the target.
              // The browser test for dragging guards this against a change in the table library.
              const drop = event as unknown as DragEvent;
              moveColumn(drop.dataTransfer?.getData("text") ?? "", (drop.currentTarget as HTMLElement).dataset.columnId ?? "");
            }}
            filterable={false}
            groupable={false}
            noDataText={t("matrix.noPersons")}
          />
        </div>
      )}

      {selected && (
        <AssignmentDialog
          person={selected.person}
          skill={selected.skill}
          assignment={selectedAssignment}
          certificates={data.certificates.filter((certificate) => certificate.assignmentId === selectedAssignment?.id)}
          onClose={() => setSelected(null)}
          onSaved={(message) => {
            setSelected(null);
            showToast(message);
            reload();
          }}
          onChanged={reload}
        />
      )}
      {assigningSeveral && (
        <BulkAssignDialog
          skills={data.skills}
          persons={data.persons.filter((person) => person.isTechnician)}
          isAssigned={(personId, skillId) => cells.has(cellKey(personId, skillId))}
          onClose={() => setAssigningSeveral(false)}
          onSaved={(message) => {
            setAssigningSeveral(false);
            showToast(message);
            reload();
          }}
          onChanged={reload}
        />
      )}
      {shownPerson && (
        <PersonDialog person={shownPerson} skills={data.skills} cells={cells} certificates={data.certificates} onClose={() => setShownPerson(null)} />
      )}
      {importing && (
        <ImportDialog
          skills={data.skills}
          persons={data.persons}
          isAssigned={(personId, skillId) => cells.has(cellKey(personId, skillId))}
          aiEnabled={aiEnabled}
          onClose={() => setImporting(false)}
          onSaved={(message) => {
            setImporting(false);
            showToast(message);
            reload();
          }}
          onChanged={reload}
        />
      )}
      {toastElement}
    </>
  );
}
