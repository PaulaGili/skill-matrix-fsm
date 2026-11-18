"use client";

import { Bar, Button, Dialog } from "@ui5/webcomponents-react";
import { AssignmentsTable } from "@/components/common/AssignmentsTable";
import { assignmentStatus, todayIso } from "@/lib/domain/status";
import type { Assignment, Certificate, Person, Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "@/components/common/AssignmentsTable.module.css";

interface Props {
  skill: Skill;
  persons: Person[];
  assignments: Assignment[];
  certificates: Certificate[];
  onClose: () => void;
}

// Everyone who holds one skill, from the data the catalogue has already loaded.
export function SkillHoldersDialog({ skill, persons, assignments, certificates, onClose }: Props) {
  const { t } = useI18n();
  const today = todayIso();
  const rows = assignments
    .filter((assignment) => assignment.skillId === skill.id)
    .flatMap((assignment) => {
      const person = persons.find((p) => p.id === assignment.personId);
      return person
        ? [{ name: person.displayName, personName: person.displayName, skillName: skill.name, assignment, status: assignmentStatus(assignment, today) }]
        : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog
      open
      headerText={skill.description ? `${skill.name}, ${skill.description}` : skill.name}
      onClose={onClose}
      footer={<Bar design="Footer" endContent={<Button onClick={onClose}>{t("action.close")}</Button>} />}
    >
      <div className={styles.inDialog}>
        <AssignmentsTable
          exportName="skill-persons"
          title={t("skill.holders", { count: rows.length })}
          emptyText={t("skill.noHolders")}
          firstColumn="field.person"
          rows={rows}
          certificates={certificates}
        />
      </div>
    </Dialog>
  );
}
