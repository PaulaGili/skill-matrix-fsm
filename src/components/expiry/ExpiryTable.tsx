"use client";

import { Button, CheckBox, Table, TableCell, TableHeaderCell, TableHeaderRow, TableRow, Text } from "@ui5/webcomponents-react";
import type { useSort } from "@/components/common/useSort";
import { formatDate } from "@/lib/domain/status";
import type { Assignment } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { RenewRow } from "./RenewDialog";

interface Props {
  title: string;
  rows: RenewRow[];
  loading: boolean;
  sort: ReturnType<typeof useSort>;
  tickedIds: string[];
  dueOf: (assignment: Assignment) => string; // "in 5 days"
  hasCertificate: (assignment: Assignment) => boolean;
  onTick: (assignmentId: string) => void;
  onView: (assignment: Assignment) => void; // show the certificates
  onEdit: (row: RenewRow) => void;
}

// The rows of the expiry page. On a narrow screen level and certificate are left out, as they
// are one click away.
export function ExpiryTable({ title, rows, loading, sort, tickedIds, dueOf, hasCertificate, onTick, onView, onEdit }: Props) {
  const { t } = useI18n();
  return (
    <Table
      loading={loading}
      accessibleName={title}
      overflowMode="Popin"
      headerRow={
        <TableHeaderRow>
          <TableHeaderCell width="3rem" importance={2} />
          <TableHeaderCell minWidth="7rem" importance={2} sortIndicator={sort.indicator("validTo")}>
            {t("field.validTo")}
          </TableHeaderCell>
          <TableHeaderCell minWidth="7rem">{t("expiry.ends")}</TableHeaderCell>
          <TableHeaderCell minWidth="9rem" importance={2} sortIndicator={sort.indicator("person")}>
            {t("field.person")}
          </TableHeaderCell>
          <TableHeaderCell minWidth="9rem" importance={1} sortIndicator={sort.indicator("skill")}>
            {t("field.skill")}
          </TableHeaderCell>
          <TableHeaderCell minWidth="7rem" importance={-1} popinHidden sortIndicator={sort.indicator("level")}>
            {t("field.level")}
          </TableHeaderCell>
          <TableHeaderCell minWidth="6.5rem" importance={-1} popinHidden sortIndicator={sort.indicator("certificate")}>
            {t("field.certificate")}
          </TableHeaderCell>
          <TableHeaderCell width="4.5rem" horizontalAlign="End" importance={2}>
            {t("field.actions")}
          </TableHeaderCell>
        </TableHeaderRow>
      }
    >
      {rows.map(({ assignment, person, skill }) => (
        <TableRow key={assignment.id} rowKey={assignment.id}>
          <TableCell>
            <CheckBox
              accessibleName={t("renew.select", { skill: skill.name, person: person.displayName })}
              checked={tickedIds.includes(assignment.id)}
              onChange={() => onTick(assignment.id)}
            />
          </TableCell>
          <TableCell>
            <Text>{formatDate(assignment.endDate!)}</Text>
          </TableCell>
          <TableCell>
            <Text>{dueOf(assignment)}</Text>
          </TableCell>
          <TableCell>
            <Text>{person.displayName}</Text>
          </TableCell>
          <TableCell>
            <Text>{skill.name}</Text>
          </TableCell>
          <TableCell>
            <Text>{assignment.levelName ?? ""}</Text>
          </TableCell>
          <TableCell>
            {hasCertificate(assignment) && (
              <Button
                design="Transparent"
                icon="attachment"
                tooltip={t("certificate.showPreview")}
                accessibleName={t("expiry.showCertificate", { person: person.displayName, skill: skill.name })}
                onClick={() => onView(assignment)}
              />
            )}
          </TableCell>
          <TableCell horizontalAlign="End">
            <Button
              design="Transparent"
              icon="edit"
              accessibleName={t("expiry.editLabel", { skill: skill.name, person: person.displayName })}
              tooltip={t("expiry.editTooltip")}
              onClick={() => onEdit({ assignment, person, skill })}
            />
          </TableCell>
        </TableRow>
      ))}
    </Table>
  );
}
