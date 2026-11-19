"use client";

import { useState } from "react";
import {
  Bar,
  Button,
  DatePicker,
  Dialog,
  Label,
  MessageStrip,
  Table,
  TableCell,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
  Text,
} from "@ui5/webcomponents-react";
import { renewalError } from "@/lib/domain/expiry";
import { formatDate } from "@/lib/domain/status";
import { toUserMessage } from "@/lib/fsm/errors";
import { MAX_BULK_ASSIGNMENTS, renewAssignments } from "@/lib/fsm/services/assignments";
import type { Assignment, Person, Skill } from "@/lib/fsm/services/model";
import { recordChange } from "@/lib/history/store";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "@/components/assignment/AssignmentDialog.module.css";

export interface RenewRow {
  assignment: Assignment;
  person: Person;
  skill: Skill;
}

interface Props {
  rows: RenewRow[];
  onClose: () => void;
  onSaved: (message: string) => void;
  onChanged: () => void; // something may have been written, reload the list
}

// One new end date for the ticked assignments, as after a yearly training of a whole crew.
// Start date and level stay. Every row shows the old and the new date before anything is saved.
export function RenewDialog({ rows, onClose, onSaved, onChanged }: Props) {
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();

  const tooMany = rows.length > MAX_BULK_ASSIGNMENTS;
  const problem =
    endDate === ""
      ? null
      : renewalError(
          rows.map((row) => row.assignment.endDate),
          endDate,
        );

  async function renew() {
    setBusy(true);
    setError(null);
    try {
      await renewAssignments(
        rows.map((row) => row.assignment),
        endDate,
      );
      for (const { assignment, person, skill } of rows) {
        const before = { levelId: assignment.levelId, levelName: assignment.levelName, startDate: assignment.startDate, endDate: assignment.endDate };
        recordChange({
          kind: "edited",
          skillId: skill.id,
          skillName: skill.name,
          personId: person.id,
          personName: person.displayName,
          assignmentId: assignment.id,
          before,
          after: { ...before, endDate },
          lostCertificates: 0,
        });
      }
      onSaved(t("renew.done", { count: rows.length }));
    } catch (e) {
      setError(toUserMessage(e, t));
      setBusy(false);
      onChanged();
    }
  }

  return (
    <Dialog
      open
      headerText={t("renew.title")}
      onBeforeClose={(event) => busy && event.preventDefault()}
      onClose={onClose}
      footer={
        <Bar
          design="Footer"
          endContent={
            <>
              <Button design="Emphasized" disabled={busy || endDate === "" || problem !== null || tooMany} onClick={renew}>
                {t("renew.confirm", { count: rows.length })}
              </Button>
              <Button design="Transparent" disabled={busy} onClick={onClose}>
                {t("action.cancel")}
              </Button>
            </>
          }
        />
      }
    >
      <div className={styles.form}>
        {error && (
          <MessageStrip design="Negative" hideCloseButton>
            {error}
          </MessageStrip>
        )}
        {tooMany && (
          <MessageStrip design="Critical" hideCloseButton>
            {t("renew.tooMany", { max: MAX_BULK_ASSIGNMENTS })}
          </MessageStrip>
        )}
        <Text>{t("renew.intro")}</Text>
        <Label for="renew-to">{t("renew.newEnd")}</Label>
        <DatePicker
          id="renew-to"
          value={endDate}
          valueFormat="yyyy-MM-dd"
          displayFormat="dd.MM.yyyy"
          placeholder={t("field.dateFormat")}
          disabled={busy}
          valueState={problem ? "Negative" : "None"}
          valueStateMessage={problem ? <span>{t(problem.key, problem.params)}</span> : undefined}
          onChange={(event) => setEndDate(event.detail.value)}
        />
        <Table
          accessibleName={t("renew.title")}
          headerRow={
            <TableHeaderRow>
              <TableHeaderCell minWidth="9rem">{t("field.person")}</TableHeaderCell>
              <TableHeaderCell minWidth="9rem">{t("field.skill")}</TableHeaderCell>
              <TableHeaderCell minWidth="12rem">{t("field.validTo")}</TableHeaderCell>
            </TableHeaderRow>
          }
        >
          {rows.map(({ assignment, person, skill }) => (
            <TableRow key={assignment.id} rowKey={assignment.id}>
              <TableCell>
                <Text>{person.displayName}</Text>
              </TableCell>
              <TableCell>
                <Text>{skill.name}</Text>
              </TableCell>
              <TableCell>
                <Text>
                  {endDate && !problem
                    ? t("renew.change", { from: formatDate(assignment.endDate!), to: formatDate(endDate) })
                    : formatDate(assignment.endDate!)}
                </Text>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </div>
    </Dialog>
  );
}
