"use client";

import { AssignmentsTable, rowsOfPerson } from "@/components/common/AssignmentsTable";
import { CloseDialog } from "@/components/common/CloseDialog";
import type { Cell } from "@/lib/domain/matrix";
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
export function PersonDialog({ person, skills, cells, certificates, onClose }: Props) {
  const { t } = useI18n();
  const rows = rowsOfPerson(person, skills, cells);
  return (
    <CloseDialog title={person.jobTitle ? `${person.displayName}, ${person.jobTitle}` : person.displayName} onClose={onClose}>
      <div className={styles.inDialog}>
        <AssignmentsTable
          exportName="person-skills"
          title={t("person.skills", { count: rows.length })}
          emptyText={t("person.none")}
          firstColumn="field.skill"
          rows={rows}
          certificates={certificates}
        />
      </div>
    </CloseDialog>
  );
}
