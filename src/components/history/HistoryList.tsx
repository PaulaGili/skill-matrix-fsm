"use client";

import { useState } from "react";
import "@ui5/webcomponents-fiori/dist/illustrations/NoEntries.js";
import {
  Bar,
  Button,
  IllustratedMessage,
  MessageStrip,
  Table,
  TableCell,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
  Text,
  Title,
} from "@ui5/webcomponents-react";
import shell from "@/components/common/AppShell.module.css";
import { useToast } from "@/components/common/useToast";
import { useAsyncData } from "@/hooks/useAsyncData";
import { canUndo, changedFields, type Change } from "@/lib/domain/history";
import { TIME_ZONE, formatDate } from "@/lib/domain/status";
import { toUserMessage } from "@/lib/fsm/errors";
import { loadChanges, recordUndone } from "@/lib/history/store";
import { undoChange } from "@/lib/history/undo";
import { useI18n } from "@/lib/i18n/I18nProvider";

// The history is in the browser's storage, which the prerendered page cannot read, so it
// is loaded after the page is shown.
const readChanges = async () => loadChanges();

// The changes made in this browser, with Undo for the latest change of each assignment.
export function HistoryList() {
  const { data, reload } = useAsyncData(readChanges);
  const changes = data ?? [];
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toastElement, showToast } = useToast();
  const { t } = useI18n();

  function describe(change: Change): string {
    if (change.kind === "assigned") return t("history.assigned");
    if (change.kind === "removed") {
      const lost = change.lostCertificates > 0 ? `, ${t("history.lostCertificates", { count: change.lostCertificates })}` : "";
      return t("history.removed") + lost;
    }
    const date = (value: string | null | undefined) => (value ? formatDate(value) : t("history.none"));
    const values = {
      level: [change.before?.levelName ?? t("history.none"), change.after?.levelName ?? t("history.none")],
      validFrom: [date(change.before?.startDate), date(change.after?.startDate)],
      validTo: [date(change.before?.endDate), date(change.after?.endDate)],
    };
    return changedFields(change)
      .map((field) => t(`history.edited.${field}`, { before: values[field][0], after: values[field][1] }))
      .join(". ");
  }

  async function undo(change: Change) {
    setBusyId(change.id);
    setError(null);
    try {
      recordUndone(change, await undoChange(change));
      showToast(t("history.undoneToast"));
    } catch (e) {
      setError(toUserMessage(e, t));
    }
    reload();
    setBusyId(null);
  }

  const time = (iso: string) => new Date(iso).toLocaleString("de-CH", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" });

  return (
    <div className={`${shell.panel} ${shell.narrow}`}>
      <Bar design="Header" startContent={<Title level="H3">{t("history.title", { count: changes.length })}</Title>} />
      <Text>{t("history.intro")}</Text>
      {error && (
        <MessageStrip design="Negative" onClose={() => setError(null)}>
          {error}
        </MessageStrip>
      )}

      {changes.length === 0 ? (
        <IllustratedMessage name="NoEntries" titleText={t("history.emptyTitle")} subtitleText={t("history.emptyText")} />
      ) : (
        <Table
          accessibleName={t("nav.history")}
          overflowMode="Popin"
          headerRow={
            <TableHeaderRow>
              <TableHeaderCell width="9rem">{t("history.when")}</TableHeaderCell>
              <TableHeaderCell minWidth="10rem">{t("field.person")}</TableHeaderCell>
              <TableHeaderCell minWidth="10rem">{t("field.skill")}</TableHeaderCell>
              <TableHeaderCell minWidth="16rem">{t("history.change")}</TableHeaderCell>
              <TableHeaderCell width="9rem" horizontalAlign="End">
                {t("field.actions")}
              </TableHeaderCell>
            </TableHeaderRow>
          }
        >
          {changes.map((change) => (
            <TableRow key={change.id} rowKey={change.id}>
              <TableCell>
                <Text>{time(change.at)}</Text>
              </TableCell>
              <TableCell>
                <Text>{change.personName}</Text>
              </TableCell>
              <TableCell>
                <Text>{change.skillName}</Text>
              </TableCell>
              <TableCell>
                <Text>{describe(change)}</Text>
              </TableCell>
              <TableCell horizontalAlign="End">
                {change.undone ? (
                  <Text>{t("history.undone")}</Text>
                ) : (
                  canUndo(change, changes) && (
                    <Button
                      icon="undo"
                      disabled={busyId !== null}
                      accessibleName={t("history.undoLabel", { person: change.personName, skill: change.skillName })}
                      onClick={() => undo(change)}
                    >
                      {t("history.undo")}
                    </Button>
                  )
                )}
              </TableCell>
            </TableRow>
          ))}
        </Table>
      )}
      {toastElement}
    </div>
  );
}
