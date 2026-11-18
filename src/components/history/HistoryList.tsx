"use client";

import { useState } from "react";
import "@ui5/webcomponents-fiori/dist/illustrations/NoEntries.js";
import {
  Button,
  FilterBar,
  FilterGroupItem,
  Icon,
  IllustratedMessage,
  Input,
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
import { PageToolbar } from "@/components/common/PageToolbar";
import { useSort, type SortColumn } from "@/components/common/useSort";
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
const SORT_COLUMNS: SortColumn[] = [
  { key: "when", label: "history.when" },
  { key: "person", label: "field.person" },
  { key: "skill", label: "field.skill" },
  { key: "change", label: "history.change" },
];

export function HistoryList() {
  const { data, reload } = useAsyncData(readChanges);
  const changes = data ?? [];
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sort = useSort();
  const [search, setSearch] = useState("");
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

  const wanted = search.trim().toLowerCase();
  const shownChanges = sort.apply(
    changes.filter((change) => change.personName.toLowerCase().includes(wanted)),
    {
      when: (change) => change.at,
      person: (change) => change.personName,
      skill: (change) => change.skillName,
      change: (change) => describe(change),
    },
  );
  const time = (iso: string) => new Date(iso).toLocaleString("de-CH", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" });

  return (
    <div className={shell.panel}>
      <div className={shell.header}>
        <Title level="H3">{t("history.title", { count: changes.length })}</Title>
        <PageToolbar
          name="changes"
          getRows={() => [
            [t("history.when"), t("field.person"), t("field.skill"), t("history.change")],
            ...shownChanges.map((change) => [time(change.at), change.personName, change.skillName, describe(change)]),
          ]}
          canExport={shownChanges.length > 0}
          onRefresh={reload}
          onError={showToast}
          sorting={{ columns: SORT_COLUMNS, sort }}
        />
      </div>
      <FilterBar
        className={shell.filterBar}
        filterContainerWidth="13rem"
        hideFilterConfiguration
        hideToggleFiltersButton
        hideToolbar
        showClearOnFB={search !== ""}
        onClear={() => setSearch("")}
      >
        <FilterGroupItem filterKey="person" label={t("field.person")}>
          <Input
            placeholder={t("filter.searchPerson")}
            accessibleName={t("filter.searchPerson")}
            showClearIcon
            icon={<Icon name="search" />}
            value={search}
            onInput={(event) => setSearch(event.target.value)}
          />
        </FilterGroupItem>
      </FilterBar>
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
              <TableHeaderCell minWidth="9rem" sortIndicator={sort.indicator("when")}>
                {t("history.when")}
              </TableHeaderCell>
              <TableHeaderCell minWidth="10rem" sortIndicator={sort.indicator("person")}>
                {t("field.person")}
              </TableHeaderCell>
              <TableHeaderCell minWidth="10rem" sortIndicator={sort.indicator("skill")}>
                {t("field.skill")}
              </TableHeaderCell>
              <TableHeaderCell minWidth="16rem" sortIndicator={sort.indicator("change")}>
                {t("history.change")}
              </TableHeaderCell>
              <TableHeaderCell width="9rem" horizontalAlign="End" importance={1}>
                {t("field.actions")}
              </TableHeaderCell>
            </TableHeaderRow>
          }
        >
          {shownChanges.map((change) => (
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
