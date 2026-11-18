"use client";

import { Bar, Button, Dialog, Link, Table, TableCell, TableHeaderCell, TableHeaderRow, TableRow, Text, Title } from "@ui5/webcomponents-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { cellKey, type Cell } from "@/lib/domain/matrix";
import { formatDate } from "@/lib/domain/status";
import { certificateUrl } from "@/lib/fsm/services/certificates";
import type { Assignment, Certificate, Person, Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./PersonDialog.module.css";

interface Props {
  person: Person;
  skills: Skill[];
  cells: Map<string, Cell<Assignment>>;
  certificates: Certificate[];
  onClose: () => void;
}

// Everything one person holds: skill, level, status, validity and the certificates behind
// it. Read-only, from the data the matrix has already loaded.
export function PersonDialog({ person, skills, cells, certificates, onClose }: Props) {
  const { t } = useI18n();
  const held = skills.flatMap((skill) => {
    const cell = cells.get(cellKey(person.id, skill.id));
    return cell ? [{ skill, ...cell }] : [];
  });

  return (
    <Dialog
      open
      headerText={person.jobTitle ? `${person.displayName}, ${person.jobTitle}` : person.displayName}
      onClose={onClose}
      footer={<Bar design="Footer" endContent={<Button onClick={onClose}>{t("action.close")}</Button>} />}
    >
      <div className={styles.content}>
        <Title level="H5">{t("person.skills", { count: held.length })}</Title>
        {held.length === 0 ? (
          <Text>{t("person.none")}</Text>
        ) : (
          <Table
            accessibleName={t("person.skills", { count: held.length })}
            overflowMode="Popin"
            headerRow={
              <TableHeaderRow>
                <TableHeaderCell minWidth="10rem">{t("field.skill")}</TableHeaderCell>
                <TableHeaderCell width="8rem">{t("field.level")}</TableHeaderCell>
                <TableHeaderCell width="9rem">{t("field.status")}</TableHeaderCell>
                <TableHeaderCell width="7rem">{t("field.validFrom")}</TableHeaderCell>
                <TableHeaderCell width="7rem">{t("field.validTo")}</TableHeaderCell>
                <TableHeaderCell minWidth="10rem">{t("person.certificates")}</TableHeaderCell>
              </TableHeaderRow>
            }
          >
            {held.map(({ skill, assignment, status }) => (
              <TableRow key={skill.id} rowKey={skill.id}>
                <TableCell>
                  <Text>{skill.name}</Text>
                </TableCell>
                <TableCell>
                  <Text>{assignment.levelName ?? ""}</Text>
                </TableCell>
                <TableCell>
                  <StatusBadge status={status} />
                </TableCell>
                <TableCell>
                  <Text>{assignment.startDate ? formatDate(assignment.startDate) : ""}</Text>
                </TableCell>
                <TableCell>
                  <Text>{assignment.endDate ? formatDate(assignment.endDate) : t("field.noEndDate")}</Text>
                </TableCell>
                <TableCell>
                  <span className={styles.files}>
                    {certificates
                      .filter((certificate) => certificate.assignmentId === assignment.id)
                      .map((certificate) => (
                        <Link key={certificate.id} href={certificateUrl(certificate)} target="_blank">
                          {certificate.fileName}
                        </Link>
                      ))}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </div>
    </Dialog>
  );
}
