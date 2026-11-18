"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import "@ui5/webcomponents-fiori/dist/illustrations/NoEntries.js";
import { Button, IllustratedMessage, Title, ToolbarButton } from "@ui5/webcomponents-react";
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
import { HELD_TODAY, cellKey, filterPersons, inColumnOrder, sortRank, type CellFilter } from "@/lib/domain/matrix";
import { matrixTable } from "@/lib/domain/export";
import { loadMatrixData } from "@/lib/fsm/services/matrix";
import type { Person, Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { AskMatrix } from "./AskMatrix";
import { MatrixFilters } from "./MatrixFilters";
import { MatrixTable } from "./MatrixTable";
import { useColumnOrder } from "./useColumnOrder";
import { useMatrixView } from "./useMatrixView";

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

  // Selecting the first skill switches on Valid and Expiring soon: "who can do this today?".
  function selectSkills(ids: string[]) {
    if (pickedSkillIds.length === 0 && ids.length > 0 && statusFilters.length === 0) {
      setStatusFilters(HELD_TODAY);
      showToast(t("filter.heldTodayOn"));
    }
    setSkillIds(ids);
  }

  const { skillIds, cells, levelNames, filters, persons, skills } = useMatrixView(data, { search, pickedSkillIds, showSystemUsers, statusFilters, levels });
  const { columnOrder, moveColumn } = useColumnOrder(data?.skills ?? []);
  const selectCell = useCallback((person: Person, skill: Skill) => setSelected({ person, skill }), []);

  // Sorted from the Sort button like the other tables. A skill puts the problems first:
  // expired, expiring soon, then valid, then the persons without the skill.
  const sort = useSort();
  const sortedPersons = sort.apply(persons, {
    person: (person) => person.displayName,
    ...Object.fromEntries(skills.map((skill) => [skill.id, (person: Person) => sortRank(cells.get(cellKey(person.id, skill.id)))])),
  });
  const sortColumns: SortColumn[] = [{ key: "person", label: "field.person" }, ...skills.map((skill) => ({ key: skill.id, text: skill.name }))];

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

          <MatrixTable
            persons={sortedPersons}
            skills={skills}
            cells={cells}
            filters={filters}
            loading={loading}
            columnOrder={columnOrder}
            onMoveColumn={moveColumn}
            onPerson={setShownPerson}
            onCell={selectCell}
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
