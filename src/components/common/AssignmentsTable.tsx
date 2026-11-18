"use client";

import { useState, type ReactNode } from "react";
import { Link, Table, TableCell, TableHeaderCell, TableHeaderRow, TableRow, Text, Title } from "@ui5/webcomponents-react";
import { CertificateDialog } from "@/components/assignment/CertificateDialog";
import { cellKey, statusRank, type Cell } from "@/lib/domain/matrix";
import { formatDate, type AssignmentStatus } from "@/lib/domain/status";
import type { Assignment, Certificate, Person, Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import shell from "./AppShell.module.css";
import { PageToolbar } from "./PageToolbar";
import { StatusBadge } from "./StatusBadge";
import { useSort } from "./useSort";
import { useToast } from "./useToast";
import styles from "./AssignmentsTable.module.css";

export interface AssignmentRow {
  name: string; // what the first column shows: the skill of a person, or the person of a skill
  personName: string;
  skillName: string;
  assignment: Assignment;
  status: AssignmentStatus;
}

// The skills one person holds, as rows of the table below.
export function rowsOfPerson(person: Person, skills: Skill[], cells: Map<string, Cell<Assignment>>): AssignmentRow[] {
  return skills.flatMap((skill) => {
    const cell = cells.get(cellKey(person.id, skill.id));
    return cell ? [{ name: skill.name, personName: person.displayName, skillName: skill.name, assignment: cell.assignment, status: cell.status }] : [];
  });
}

interface Props {
  exportName: string; // start of the export file name
  title: string;
  emptyText: string;
  firstColumn: MessageKey;
  rows: AssignmentRow[];
  certificates: Certificate[];
  filters?: ReactNode; // a filter bar between the title and the table
  loading?: boolean;
  onRefresh?: () => void;
}

// Assignments with level, status, validity and certificates, read-only. The person view
// lists the skills of one person with it, the skill view the persons of one skill.
export function AssignmentsTable({ exportName, title, emptyText, firstColumn, rows, certificates, filters, loading, onRefresh }: Props) {
  const { t } = useI18n();
  const [viewed, setViewed] = useState<{ certificate: Certificate; title: string } | null>(null);
  const sort = useSort();
  const certificatesOf = (assignment: Assignment) => certificates.filter((certificate) => certificate.assignmentId === assignment.id);
  const shown = sort.apply(rows, {
    name: (row) => row.name,
    level: (row) => row.assignment.level ?? 0,
    status: (row) => statusRank(row.status),
    validFrom: (row) => row.assignment.startDate ?? "",
    validTo: (row) => row.assignment.endDate ?? "9999",
    certificates: (row) => certificatesOf(row.assignment).length,
  });
  // No fixed widths: the columns share the table, so the last one ends where the table ends.
  const columns: { key: string; label: MessageKey; minWidth: string }[] = [
    { key: "name", label: firstColumn, minWidth: "10rem" },
    { key: "level", label: "field.level", minWidth: "7rem" },
    { key: "status", label: "field.status", minWidth: "9rem" },
    { key: "validFrom", label: "field.validFrom", minWidth: "7rem" },
    { key: "validTo", label: "field.validTo", minWidth: "7rem" },
    { key: "certificates", label: "person.certificates", minWidth: "10rem" },
  ];

  const { toastElement, showToast } = useToast();
  const exportRows = () => [
    columns.map((column) => t(column.label)),
    ...shown.map(({ name, assignment, status }) => [
      name,
      assignment.levelName ?? "",
      t(`status.${status}`),
      assignment.startDate ? formatDate(assignment.startDate) : "",
      assignment.endDate ? formatDate(assignment.endDate) : t("field.noEndDate"),
      certificatesOf(assignment)
        .map((certificate) => certificate.fileName)
        .join(", "),
    ]),
  ];

  return (
    <div className={styles.content}>
      <div className={shell.header}>
        <Title level="H3">{title}</Title>
        {(rows.length > 0 || onRefresh) && (
          <PageToolbar
            name={exportName}
            getRows={exportRows}
            canExport={rows.length > 0}
            onError={showToast}
            sorting={{ columns, sort }}
            loading={loading}
            onRefresh={onRefresh}
          />
        )}
      </div>
      {filters}
      {rows.length === 0 ? (
        <Text>{emptyText}</Text>
      ) : (
        <Table
          accessibleName={title}
          overflowMode="Popin"
          headerRow={
            <TableHeaderRow>
              {columns.map((column) => (
                <TableHeaderCell key={column.key} minWidth={column.minWidth} sortIndicator={sort.indicator(column.key)}>
                  {t(column.label)}
                </TableHeaderCell>
              ))}
            </TableHeaderRow>
          }
        >
          {shown.map(({ name, personName, skillName, assignment, status }) => (
            <TableRow key={assignment.id} rowKey={assignment.id}>
              <TableCell>
                <Text>{name}</Text>
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
                  {certificatesOf(assignment).map((certificate) => (
                    <Link
                      key={certificate.id}
                      onClick={() => setViewed({ certificate, title: t("expiry.certificateTitle", { person: personName, skill: skillName }) })}
                    >
                      {certificate.fileName}
                    </Link>
                  ))}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      )}
      {toastElement}
      {viewed && <CertificateDialog title={viewed.title} certificates={[viewed.certificate]} onClose={() => setViewed(null)} />}
    </div>
  );
}
