"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "@ui5/webcomponents-fiori/dist/illustrations/NoEntries.js";
import {
  AnalyticalTable,
  AnalyticalTableHooks,
  Button,
  IllustratedMessage,
  Link,
  Title,
  ToolbarButton,
  type AnalyticalTableCellInstance,
  type AnalyticalTableColumnDefinition,
} from "@ui5/webcomponents-react";
import { AssignmentDialog } from "@/components/assignment/AssignmentDialog";
import { BulkAssignDialog } from "@/components/assignment/BulkAssignDialog";
import shell from "@/components/common/AppShell.module.css";
import { ImportDialog } from "./ImportDialog";
import { PersonDialog } from "./PersonDialog";
import { PageToolbar } from "@/components/common/PageToolbar";
import { useSort, type SortColumn } from "@/components/common/useSort";
import { LoadError, Loading } from "@/components/common/LoadState";
import { useToast } from "@/components/common/useToast";
import { useAiEnabled } from "@/hooks/useAiEnabled";
import { useAsyncData } from "@/hooks/useAsyncData";
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
  type CellFilter,
  levelNamesOf,
} from "@/lib/domain/matrix";
import { matrixTable } from "@/lib/domain/export";
import { todayIso } from "@/lib/domain/status";
import { loadMatrixData } from "@/lib/fsm/services/matrix";
import type { Person, Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { AskMatrix } from "./AskMatrix";
import { MatrixCell } from "./MatrixCell";
import { MatrixFilters } from "./MatrixFilters";
import { useColumnOrder } from "./useColumnOrder";
import styles from "./SkillMatrix.module.css";

const VISIBLE_ROWS = 15;
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
  const aiEnabled = useAiEnabled();
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

  const levelNames = useMemo(() => levelNamesOf(data?.assignments ?? []), [data]);

  const filters = useMemo(() => ({ statuses: statusFilters, levels }), [statusFilters, levels]);

  const { columnOrder, moveColumn } = useColumnOrder(data?.skills ?? []);

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

  // Sorted from the Sort button like the other tables. A skill puts the problems first:
  // expired, expiring soon, then valid, then the persons without the skill.
  const sort = useSort();
  const sortedPersons = sort.apply(persons, {
    person: (person) => person.displayName,
    ...Object.fromEntries(skills.map((skill) => [skill.id, (person: Person) => sortRank(cells.get(cellKey(person.id, skill.id)))])),
  });
  const sortColumns: SortColumn[] = [{ key: "person", label: "field.person" }, ...skills.map((skill) => ({ key: skill.id, text: skill.name }))];

  const columns = useMemo<AnalyticalTableColumnDefinition[]>(
    () => [
      {
        Header: t("field.person"),
        id: "person",
        accessor: "displayName",
        sticky: "start",
        disableSticky: true,
        disableDragAndDrop: true,
        width: 220,
        vAlign: "Middle",
        Cell: ({ row }: AnalyticalTableCellInstance) => {
          const person = row.original as Person;
          return (
            <span className={styles.person}>
              <Link accessibleRole="Button" accessibleName={t("person.openLabel", { name: person.displayName })} onClick={() => setShownPerson(person)}>
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
        minWidth: 160,
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
              onSelect={() => setSelected({ person, skill })}
            />
          );
        },
      })),
    ],
    [skills, cells, filters, t],
  );

  if (!data) return error ? <LoadError message={error} onRetry={reload} /> : <Loading />;

  // How many persons there are without any filter, to show "2 of 12".
  const total = filterPersons(data.persons, "", showSystemUsers).length;
  const selectedAssignment = selected ? cells.get(cellKey(selected.person.id, selected.skill.id))?.assignment : undefined;

  return (
    <div className={shell.panel}>
      <div className={shell.header}>
        <Title level="H3">{persons.length === total ? t("matrix.persons", { count: total }) : t("matrix.personsOf", { count: persons.length, total })}</Title>
        <PageToolbar
          name="skill-matrix"
          getRows={() => matrixTable(sortedPersons, inColumnOrder(skills, columnOrder), cells, filters, t)}
          canExport={data.skills.length > 0}
          loading={loading}
          onRefresh={reload}
          onError={showToast}
          sorting={{ columns: sortColumns, sort }}
        >
          {data.skills.length > 0 && (
            <ToolbarButton
              design="Emphasized"
              overflowPriority="NeverOverflow"
              icon="add-employee"
              text={t("matrix.assignSeveral")}
              tooltip={t("matrix.assignSeveralTooltip")}
              onClick={() => setAssigningSeveral(true)}
            />
          )}
          {data.skills.length > 0 && (
            <ToolbarButton overflowPriority="AlwaysOverflow" icon="upload" text={t("import.button")} onClick={() => setImporting(true)} />
          )}
          <ToolbarButton
            overflowPriority="AlwaysOverflow"
            icon="group"
            text={t(showSystemUsers ? "filter.hideSystemUsers" : "filter.showSystemUsers")}
            onClick={() => setShowSystemUsers(!showSystemUsers)}
          />
        </PageToolbar>
      </div>
      {error && <LoadError message={error} onRetry={reload} />}

      {data.skills.length === 0 ? (
        <IllustratedMessage name="NoEntries" titleText={t("matrix.noSkillsTitle")} subtitleText={t("matrix.noSkillsText")}>
          <Button onClick={() => router.push("/catalog")}>{t("matrix.openCatalog")}</Button>
        </IllustratedMessage>
      ) : (
        <>
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
            columns={columns}
            data={sortedPersons}
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
              moveColumn(drop.dataTransfer?.getData("text") ?? "", (drop.currentTarget as HTMLElement).dataset.columnId ?? "");
            }}
            noDataText={t("matrix.noPersons")}
          />
        </>
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
    </div>
  );
}
