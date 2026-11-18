"use client";

import { useState } from "react";
import "@ui5/webcomponents-fiori/dist/illustrations/NoEntries.js";
import { Bar, Button, IllustratedMessage, Table, TableCell, TableHeaderCell, TableHeaderRow, TableRow, Text, Title } from "@ui5/webcomponents-react";
import { LoadError, Loading } from "@/components/common/LoadState";
import { useToast } from "@/components/common/useToast";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listAssignments } from "@/lib/fsm/services/assignments";
import { listCertificates } from "@/lib/fsm/services/certificates";
import type { Skill } from "@/lib/fsm/services/model";
import { listSkills } from "@/lib/fsm/services/skills";
import shell from "@/components/common/AppShell.module.css";
import { RemoveSkillDialog } from "./RemoveSkillDialog";
import { SkillDialog } from "./SkillDialog";

async function loadCatalog() {
  const [skills, assignments, certificates] = await Promise.all([listSkills(), listAssignments(), listCertificates()]);
  return { skills, assignments, certificates };
}

type OpenDialog = { type: "create" } | { type: "edit"; skill: Skill } | { type: "remove"; skill: Skill } | null;

export function SkillCatalog() {
  const { data, error, loading, reload } = useAsyncData(loadCatalog);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const { toastElement, showToast } = useToast();

  function finish(message: string) {
    setDialog(null);
    showToast(message);
    reload();
  }

  if (!data) return error ? <LoadError message={error} onRetry={reload} /> : <Loading />;

  const { skills, assignments, certificates } = data;
  const assignmentsOf = (skill: Skill) => assignments.filter((assignment) => assignment.skillId === skill.id);

  return (
    <div className={shell.panel}>
      <Bar
        design="Header"
        startContent={<Title level="H3">Skills ({skills.length})</Title>}
        endContent={
          <Button design="Emphasized" icon="add" onClick={() => setDialog({ type: "create" })}>
            Create skill
          </Button>
        }
      />
      {error && <LoadError message={error} onRetry={reload} />}

      {skills.length === 0 ? (
        <IllustratedMessage name="NoEntries" titleText="No skills yet" subtitleText="Create the first skill to start the matrix.">
          <Button onClick={() => setDialog({ type: "create" })}>Create skill</Button>
        </IllustratedMessage>
      ) : (
        <Table
          loading={loading}
          accessibleName="Skills"
          overflowMode="Popin"
          headerRow={
            <TableHeaderRow>
              <TableHeaderCell minWidth="12rem">Name</TableHeaderCell>
              <TableHeaderCell minWidth="12rem">Description</TableHeaderCell>
              <TableHeaderCell width="8rem" horizontalAlign="Center">
                Assignments
              </TableHeaderCell>
              <TableHeaderCell width="7rem" horizontalAlign="End">
                Actions
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
              <TableCell horizontalAlign="Center">
                <Text>{assignmentsOf(skill).length}</Text>
              </TableCell>
              <TableCell horizontalAlign="End">
                <Button
                  design="Transparent"
                  icon="edit"
                  accessibleName={`Edit ${skill.name}`}
                  tooltip="Edit"
                  onClick={() => setDialog({ type: "edit", skill })}
                />
                <Button
                  design="Transparent"
                  icon="delete"
                  accessibleName={`Delete ${skill.name}`}
                  tooltip="Delete"
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
