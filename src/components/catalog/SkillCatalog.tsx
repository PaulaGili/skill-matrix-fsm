"use client";

import { useState } from "react";
import "@ui5/webcomponents-fiori/dist/illustrations/NoEntries.js";
import {
  Bar,
  Button,
  IllustratedMessage,
  ObjectStatus,
  Table,
  TableCell,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
  Text,
  Title,
} from "@ui5/webcomponents-react";
import { LoadError, Loading } from "@/components/common/LoadState";
import { useToast } from "@/components/common/useToast";
import { useAsyncData } from "@/hooks/useAsyncData";
import { assignmentStatus, todayIso } from "@/lib/domain/status";
import { listAssignments } from "@/lib/fsm/services/assignments";
import { listCertificates } from "@/lib/fsm/services/certificates";
import type { Skill } from "@/lib/fsm/services/model";
import { listSkills } from "@/lib/fsm/services/skills";
import { useI18n } from "@/lib/i18n/I18nProvider";
import shell from "@/components/common/AppShell.module.css";
import styles from "./SkillCatalog.module.css";
import { RemoveSkillDialog } from "./RemoveSkillDialog";
import { SkillDialog } from "./SkillDialog";

async function loadCatalog() {
  const [skills, assignments, certificates] = await Promise.all([listSkills(), listAssignments(), listCertificates()]);
  return { skills, assignments, certificates };
}

// How the assignments of a skill are shown in the list, problems first.
const COUNTS = [
  { status: "expired", state: "Negative" },
  { status: "expiring", state: "Critical" },
  { status: "valid", state: "Positive" },
  { status: "notYetValid", state: "Information" },
] as const;

type OpenDialog = { type: "create" } | { type: "edit"; skill: Skill } | { type: "remove"; skill: Skill } | null;

export function SkillCatalog() {
  const { data, error, loading, reload } = useAsyncData(loadCatalog);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const { toastElement, showToast } = useToast();
  const { t } = useI18n();

  function finish(message: string) {
    setDialog(null);
    showToast(message);
    reload();
  }

  if (!data) return error ? <LoadError message={error} onRetry={reload} /> : <Loading />;

  const { skills, assignments, certificates } = data;
  const assignmentsOf = (skill: Skill) => assignments.filter((assignment) => assignment.skillId === skill.id);
  const today = todayIso();
  const countOf = (skill: Skill, status: string) => assignmentsOf(skill).filter((assignment) => assignmentStatus(assignment, today) === status).length;

  return (
    <div className={`${shell.panel} ${shell.narrow}`}>
      <Bar
        design="Header"
        startContent={<Title level="H3">{t("catalog.title", { count: skills.length })}</Title>}
        endContent={
          <Button design="Emphasized" icon="add" onClick={() => setDialog({ type: "create" })}>
            {t("catalog.create")}
          </Button>
        }
      />
      {error && <LoadError message={error} onRetry={reload} />}

      {skills.length === 0 ? (
        <IllustratedMessage name="NoEntries" titleText={t("matrix.noSkillsTitle")} subtitleText={t("catalog.emptyText")}>
          <Button onClick={() => setDialog({ type: "create" })}>{t("catalog.create")}</Button>
        </IllustratedMessage>
      ) : (
        <Table
          loading={loading}
          accessibleName={t("catalog.tableName")}
          overflowMode="Popin"
          headerRow={
            <TableHeaderRow>
              <TableHeaderCell minWidth="12rem">{t("field.name")}</TableHeaderCell>
              <TableHeaderCell minWidth="12rem">{t("field.description")}</TableHeaderCell>
              <TableHeaderCell minWidth="14rem">{t("catalog.assignments")}</TableHeaderCell>
              <TableHeaderCell width="13rem" horizontalAlign="End">
                {t("field.actions")}
              </TableHeaderCell>
            </TableHeaderRow>
          }
        >
          {skills.map((skill) => (
            <TableRow key={skill.id} rowKey={skill.id}>
              <TableCell>
                <Text>{skill.name}</Text>
              </TableCell>
              <TableCell>
                <Text>{skill.description ?? ""}</Text>
              </TableCell>
              <TableCell>
                <span className={styles.counts}>
                  {assignmentsOf(skill).length === 0 && <Text>{t("catalog.notAssigned")}</Text>}
                  {COUNTS.filter(({ status }) => countOf(skill, status) > 0).map(({ status, state }) => (
                    <ObjectStatus key={status} state={state}>
                      {t(`catalog.count.${status}`, { count: countOf(skill, status) })}
                    </ObjectStatus>
                  ))}
                </span>
              </TableCell>
              <TableCell horizontalAlign="End">
                <Button
                  design="Transparent"
                  icon="edit"
                  accessibleName={t("catalog.editSkill", { name: skill.name })}
                  onClick={() => setDialog({ type: "edit", skill })}
                >
                  {t("action.edit")}
                </Button>
                <Button
                  design="Transparent"
                  icon="delete"
                  accessibleName={t("catalog.deleteSkill", { name: skill.name })}
                  onClick={() => setDialog({ type: "remove", skill })}
                >
                  {t("action.delete")}
                </Button>
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
          assignments={assignmentsOf(dialog.skill)}
          certificates={certificates.filter((c) => assignmentsOf(dialog.skill).some((a) => a.id === c.assignmentId))}
          onClose={() => setDialog(null)}
          onDone={finish}
          onFailed={reload}
        />
      )}
      {toastElement}
    </div>
  );
}
