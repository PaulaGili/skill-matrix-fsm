"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "@ui5/webcomponents-fiori/dist/illustrations/NoEntries.js";
import {
  AnalyticalTable,
  AnalyticalTableHooks,
  Button,
  IllustratedMessage,
  Title,
  type AnalyticalTableCellInstance,
  type AnalyticalTableColumnDefinition,
} from "@ui5/webcomponents-react";
import { AssignmentDialog } from "@/components/assignment/AssignmentDialog";
import { BulkAssignDialog } from "@/components/assignment/BulkAssignDialog";
import shell from "@/components/common/AppShell.module.css";
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
  personPasses,
  skillsWithMatches,
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
  const { toastElement, showToast } = useToast();
  const aiEnabled = useAsyncData(isAiEnabled).data === true;
  const { t } = useI18n();
  const today = todayIso();

  // Selecting the first skill switches on Valid and Expiring soon: "who can do this today?".
  function selectSkills(ids: string[]) {
    if (pickedSkillIds.length === 0 && ids.length > 0 && statusFilters.length === 0) setStatusFilters(HELD_TODAY);
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
        sticky: "start",
        disableSticky: true,
        width: 260,
        vAlign: "Middle",
        Cell: ({ row }: AnalyticalTableCellInstance) => {
          const person = row.original as Person;
          return (
            <span className={styles.person}>
              <span>{person.displayName}</span>
              <span className={styles.detail}>{person.isTechnician ? person.jobTitle : t("matrix.systemUser")}</span>
            </span>
          );
        },
      },
      ...skills.map((skill): AnalyticalTableColumnDefinition => ({
        Header: skill.name,
        id: skill.id,
        disableSticky: true,
        minWidth: 200,
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

  const selectedAssignment = selected ? cells.get(cellKey(selected.person.id, selected.skill.id))?.assignment : undefined;

  return (
    <>
      <div className={styles.header}>
        <Title level="H2">{t("nav.matrix")}</Title>
        <span className={styles.inline}>
          {data.skills.length > 0 && <ExportButton name="skill-matrix" getRows={() => matrixTable(persons, skills, cells, filters, t)} onError={showToast} />}
          {data.skills.length > 0 && (
            <Button icon="add-employee" tooltip={t("matrix.assignSeveralTooltip")} onClick={() => setAssigningSeveral(true)}>
              {t("matrix.assignSeveral")}
            </Button>
          )}
          <Button icon="refresh" tooltip={t("action.refreshTooltip")} disabled={loading} onClick={reload}>
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
            showSystemUsers={showSystemUsers}
            onSearch={setSearch}
            onSkillIds={selectSkills}
            onLevels={setLevels}
            onStatusFilters={setStatusFilters}
            onShowSystemUsers={setShowSystemUsers}
          />

          <AnalyticalTable
            header={<Title level="H5">{t("matrix.persons", { count: persons.length })}</Title>}
            columns={columns}
            data={persons}
            tableHooks={TABLE_HOOKS}
            loading={loading}
            visibleRows={VISIBLE_ROWS}
            minRows={1}
            rowHeight={56}
            sortable={false}
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
      {toastElement}
    </>
  );
}
