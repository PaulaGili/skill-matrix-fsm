"use client";

import { useState } from "react";
import "@ui5/webcomponents-fiori/dist/illustrations/NoEntries.js";
import {
  Button,
  FilterBar,
  FilterGroupItem,
  Icon,
  IllustratedMessage,
  Input,
  Link,
  Table,
  TableCell,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
  Text,
  Title,
  ToolbarButton,
} from "@ui5/webcomponents-react";
import { LoadError, Loading } from "@/components/common/LoadState";
import { PageToolbar } from "@/components/common/PageToolbar";
import { useSort, type SortColumn } from "@/components/common/useSort";
import { useToast } from "@/components/common/useToast";
import { useAsyncData } from "@/hooks/useAsyncData";
import { indexAssignments } from "@/lib/domain/matrix";
import { todayIso } from "@/lib/domain/status";
import { loadMatrixData } from "@/lib/fsm/services/matrix";
import type { Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import shell from "@/components/common/AppShell.module.css";
import { RemoveSkillDialog } from "./RemoveSkillDialog";
import { SkillDialog } from "./SkillDialog";
import { SkillHoldersDialog } from "./SkillHoldersDialog";

const SORT_COLUMNS: SortColumn[] = [
  { key: "name", label: "field.name" },
  { key: "description", label: "field.description" },
  { key: "assignments", label: "catalog.assignments" },
];

type OpenDialog = { type: "create" } | { type: "edit"; skill: Skill } | { type: "remove"; skill: Skill } | { type: "holders"; skill: Skill } | null;

export function SkillCatalog() {
  const { data, error, loading, reload } = useAsyncData(loadMatrixData);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [search, setSearch] = useState("");
  const sort = useSort();
  const { toastElement, showToast } = useToast();
  const { t } = useI18n();

  function finish(message: string) {
    setDialog(null);
    showToast(message);
    reload();
  }

  if (!data) return error ? <LoadError message={error} onRetry={reload} /> : <Loading />;

  const { persons, skills, assignments, certificates } = data;
  const wanted = search.trim().toLowerCase();
  const today = todayIso();
  // Counted like the matrix shows them: one assignment per person and skill, known persons only.
  const shownAssignments = [...indexAssignments(assignments, today).values()].filter((assignment) =>
    persons.some((person) => person.id === assignment.personId),
  );
  const assignmentsOf = (skill: Skill) => shownAssignments.filter((assignment) => assignment.skillId === skill.id);
  const matching = skills.filter((skill) => `${skill.name} ${skill.description ?? ""}`.toLowerCase().includes(wanted));
  const shown = sort.apply(matching, {
    name: (skill) => skill.name,
    description: (skill) => skill.description ?? "",
    assignments: (skill) => assignmentsOf(skill).length,
  });
  const exportRows = () => [
    [t("field.name"), t("field.description"), t("catalog.assignments")],
    ...shown.map((skill) => [skill.name, skill.description ?? "", String(assignmentsOf(skill).length)]),
  ];

  return (
    <div className={shell.panel}>
      <div className={shell.header}>
        <Title level="H3">{t("catalog.title", { count: skills.length })}</Title>
        <PageToolbar
          name="skill-catalogue"
          getRows={exportRows}
          canExport={shown.length > 0}
          loading={loading}
          onRefresh={reload}
          onError={showToast}
          sorting={{ columns: SORT_COLUMNS, sort }}
        >
          <ToolbarButton
            design="Emphasized"
            overflowPriority="NeverOverflow"
            icon="add"
            text={t("catalog.create")}
            onClick={() => setDialog({ type: "create" })}
          />
        </PageToolbar>
      </div>
      {error && <LoadError message={error} onRetry={reload} />}

      {skills.length > 0 && (
        <FilterBar
          className={shell.filterBar}
          filterContainerWidth="13rem"
          hideFilterConfiguration
          hideToggleFiltersButton
          hideToolbar
          showClearOnFB={search !== ""}
          onClear={() => setSearch("")}
        >
          <FilterGroupItem filterKey="skill" label={t("field.skill")}>
            <Input
              placeholder={t("catalog.search")}
              accessibleName={t("catalog.search")}
              showClearIcon
              icon={<Icon name="search" />}
              value={search}
              onInput={(event) => setSearch(event.target.value)}
            />
          </FilterGroupItem>
        </FilterBar>
      )}
      {skills.length > 0 && shown.length === 0 && <Text>{t("catalog.noMatch")}</Text>}

      {skills.length === 0 ? (
        <IllustratedMessage name="NoEntries" titleText={t("matrix.noSkillsTitle")} subtitleText={t("catalog.emptyText")}>
          <Button onClick={() => setDialog({ type: "create" })}>{t("catalog.create")}</Button>
        </IllustratedMessage>
      ) : shown.length === 0 ? null : (
        <Table
          loading={loading}
          accessibleName={t("catalog.tableName")}
          overflowMode="Popin"
          headerRow={
            <TableHeaderRow>
              <TableHeaderCell minWidth="10rem" importance={2} sortIndicator={sort.indicator("name")}>
                {t("field.name")}
              </TableHeaderCell>
              <TableHeaderCell minWidth="10rem" importance={-1} popinHidden sortIndicator={sort.indicator("description")}>
                {t("field.description")}
              </TableHeaderCell>
              <TableHeaderCell minWidth="7.5rem" sortIndicator={sort.indicator("assignments")}>
                {t("catalog.assignments")}
              </TableHeaderCell>
              <TableHeaderCell width="6rem" horizontalAlign="End" importance={1}>
                {t("field.actions")}
              </TableHeaderCell>
            </TableHeaderRow>
          }
        >
          {shown.map((skill) => (
            <TableRow key={skill.id} rowKey={skill.id}>
              <TableCell>
                <Link accessibleRole="Button" accessibleName={t("skill.openLabel", { name: skill.name })} onClick={() => setDialog({ type: "holders", skill })}>
                  {skill.name}
                </Link>
              </TableCell>
              <TableCell>
                <Text>{skill.description ?? ""}</Text>
              </TableCell>
              <TableCell>
                <Text>{assignmentsOf(skill).length}</Text>
              </TableCell>
              <TableCell horizontalAlign="End">
                <Button
                  design="Transparent"
                  icon="edit"
                  tooltip={t("action.edit")}
                  accessibleName={t("catalog.editSkill", { name: skill.name })}
                  onClick={() => setDialog({ type: "edit", skill })}
                />
                <Button
                  design="Transparent"
                  icon="delete"
                  tooltip={t("action.delete")}
                  accessibleName={t("catalog.deleteSkill", { name: skill.name })}
                  onClick={() => setDialog({ type: "remove", skill })}
                />
              </TableCell>
            </TableRow>
          ))}
        </Table>
      )}

      {(dialog?.type === "create" || dialog?.type === "edit") && (
        <SkillDialog skill={dialog.type === "edit" ? dialog.skill : null} existingSkills={skills} onClose={() => setDialog(null)} onSaved={finish} />
      )}
      {dialog?.type === "remove" && (
        <RemoveSkillDialog
          skill={dialog.skill}
          assignments={assignments.filter((assignment) => assignment.skillId === dialog.skill.id)}
          certificates={certificates.filter((c) => assignmentsOf(dialog.skill).some((a) => a.id === c.assignmentId))}
          onClose={() => setDialog(null)}
          onDone={finish}
          onFailed={reload}
        />
      )}
      {dialog?.type === "holders" && (
        <SkillHoldersDialog skill={dialog.skill} persons={persons} assignments={shownAssignments} certificates={certificates} onClose={() => setDialog(null)} />
      )}
      {toastElement}
    </div>
  );
}
