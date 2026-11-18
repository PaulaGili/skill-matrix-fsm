"use client";

import { Bar, Button, Dialog } from "@ui5/webcomponents-react";
import { AssignmentsTable } from "@/components/common/AssignmentsTable";
import { cellKey, type Cell } from "@/lib/domain/matrix";
import type { Assignment, Certificate, Person, Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "@/components/common/AssignmentsTable.module.css";

interface Props {
  person: Person;
  skills: Skill[];
  cells: Map<string, Cell<Assignment>>;
  certificates: Certificate[];
  onClose: () => void;
}

// Everything one person holds, from data that is already loaded.
export function PersonSkills({ person, skills, cells, certificates }: Omit<Props, "onClose">) {
  const { t } = useI18n();
  const rows = skills.flatMap((skill) => {
    const cell = cells.get(cellKey(person.id, skill.id));
    return cell ? [{ name: skill.name, personName: person.displayName, skillName: skill.name, assignment: cell.assignment, status: cell.status }] : [];
  });
  return (
    <AssignmentsTable
      exportName="person-skills"
      title={t("person.skills", { count: rows.length })}
      emptyText={t("person.none")}
      firstColumn="field.skill"
      rows={rows}
      certificates={certificates}
    />
  );
}

export function PersonDialog({ person, onClose, ...data }: Props) {
  const { t } = useI18n();
  return (
    <Dialog
      open
      headerText={person.jobTitle ? `${person.displayName}, ${person.jobTitle}` : person.displayName}
      onClose={onClose}
      footer={<Bar design="Footer" endContent={<Button onClick={onClose}>{t("action.close")}</Button>} />}
    >
      <div className={styles.inDialog}>
        <PersonSkills person={person} {...data} />
      </div>
    </Dialog>
  );
}
