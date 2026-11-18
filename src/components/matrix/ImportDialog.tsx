"use client";

import { useCallback, useState } from "react";
import {
  Bar,
  Button,
  CheckBox,
  Dialog,
  FileUploader,
  MessageStrip,
  ObjectStatus,
  Table,
  TableCell,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
  Text,
} from "@ui5/webcomponents-react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { matchImportColumns } from "@/lib/ai/client";
import {
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  guessColumns,
  isEmptyRow,
  parseCsv,
  toImportRows,
  unusedColumns,
  withProposed,
  type ColumnMap,
} from "@/lib/domain/import";
import { formatDate } from "@/lib/domain/status";
import { toUserMessage } from "@/lib/fsm/errors";
import { createAssignments } from "@/lib/fsm/services/assignments";
import type { Level, Person, Skill } from "@/lib/fsm/services/model";
import { listLevels } from "@/lib/fsm/services/scale";
import { recordAssigned } from "@/lib/history/store";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./ImportDialog.module.css";

interface Props {
  skills: Skill[];
  persons: Person[];
  isAssigned: (personId: string, skillId: string) => boolean;
  aiEnabled: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  onChanged: () => void; // something may have been written, reload the matrix
}

interface Sheet {
  headers: string[];
  rows: unknown[][];
  columns: ColumnMap;
  byAi: boolean;
}

async function readRows(file: File): Promise<unknown[][]> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    // Excel on Windows saves CSV files in its own encoding, not UTF-8.
    const bytes = await file.arrayBuffer();
    try {
      return parseCsv(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      return parseCsv(new TextDecoder("windows-1252").decode(bytes));
    }
  }
  const { readSheet } = await import("read-excel-file/browser");
  return readSheet(file);
}

// Creates assignments from a file. Every row is shown first with what it would create or why
// it cannot be imported, and only the ticked rows are saved.
export function ImportDialog({ skills, persons, isAssigned, aiEnabled, onClose, onSaved, onChanged }: Props) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();

  const loadLevels = useCallback(async () => {
    const scaleIds = [...new Set(skills.map((skill) => skill.scaleId).filter((id) => id !== null))];
    const lists = await Promise.all(scaleIds.map(listLevels));
    return Object.fromEntries(scaleIds.map((id, index) => [id, lists[index]])) as Record<string, Level[]>;
  }, [skills]);
  const levels = useAsyncData(loadLevels).data;

  const rows = sheet && levels ? toImportRows(sheet.rows, sheet.columns, { persons, skills, levels, isAssigned }) : [];
  const chosen = rows.filter((row) => !row.problem && !skipped.includes(row.line));
  const allLevels = Object.values(levels ?? {}).flat();
  const levelName = (levelId: string | null) => allLevels.find((level) => level.id === levelId)?.name ?? "";

  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setSheet(null);
    setSkipped([]);
    try {
      const [first, ...body] = await readRows(file).catch(() => []);
      const headers = (first ?? []).map((header) => String(header ?? ""));
      const count = body.filter((row) => !isEmptyRow(row)).length;
      if (headers.length === 0 || count === 0) setError(t("import.unreadable"));
      else if (count > MAX_IMPORT_ROWS) setError(t("import.tooMany", { count, max: MAX_IMPORT_ROWS }));
      else {
        // Usual titles are matched here. For a title that is left over the AI is asked, with
        // the titles alone, and it only fills fields that are still open.
        let columns = guessColumns(headers);
        let byAi = false;
        const left = unusedColumns(headers, columns);
        if (aiEnabled && left.length > 0 && Object.values(columns).includes(null)) {
          // If the AI cannot be reached, the import goes on with what the code recognised.
          const proposed = await matchImportColumns(left.map((column) => headers[column])).catch(() => null);
          const filled = proposed ? withProposed(columns, proposed, left) : columns;
          byAi = IMPORT_FIELDS.some((field) => filled[field] !== columns[field]);
          columns = filled;
        }
        if (columns.person === null || columns.skill === null) setError(t("import.noColumns"));
        else setSheet({ headers, rows: body, columns, byAi });
      }
    } catch (e) {
      setError(toUserMessage(e, t));
    }
    setBusy(false);
  }

  // One request per skill. If one fails, the rows saved before it show as already assigned.
  async function importRows() {
    setBusy(true);
    setError(null);
    let done = 0;
    try {
      for (const skill of skills) {
        const forSkill = chosen.filter((row) => row.skillId === skill.id);
        if (forSkill.length === 0) continue;
        const created = await createAssignments(
          skill.id,
          forSkill.map((row) => ({ personId: row.personId!, levelId: row.levelId, startDate: row.startDate, endDate: row.endDate })),
        );
        done += created.length;
        for (const assignment of created) {
          recordAssigned(skill.name, persons.find((person) => person.id === assignment.personId)?.displayName ?? "", assignment);
        }
      }
      onSaved(t("import.done", { count: done }));
    } catch (e) {
      setError(toUserMessage(e, t));
      setBusy(false);
      onChanged();
    }
  }

  const notUsed = sheet ? unusedColumns(sheet.headers, sheet.columns).map((column) => sheet.headers[column]) : [];
  const usedColumns = sheet
    ? IMPORT_FIELDS.filter((field) => sheet.columns[field] !== null)
        .map((field) => sheet.headers[sheet.columns[field]!])
        .join(", ")
    : "";

  return (
    <Dialog
      open
      headerText={t("import.title")}
      onBeforeClose={(event) => busy && event.preventDefault()}
      onClose={onClose}
      footer={
        <Bar
          design="Footer"
          endContent={
            <>
              <Button design="Emphasized" disabled={busy || chosen.length === 0} onClick={importRows}>
                {t("import.confirm", { count: chosen.length })}
              </Button>
              <Button design="Transparent" disabled={busy} onClick={onClose}>
                {t("action.cancel")}
              </Button>
            </>
          }
        />
      }
    >
      <div className={styles.content}>
        <Text>{t("import.intro", { max: MAX_IMPORT_ROWS })}</Text>
        {error && (
          <MessageStrip design="Negative" hideCloseButton>
            {error}
          </MessageStrip>
        )}
        <FileUploader hideInput accept=".xlsx,.csv" disabled={busy || !levels} onChange={(event) => choose(event.detail.files?.[0])}>
          <Button icon="upload" disabled={busy || !levels}>
            {t("import.chooseFile")}
          </Button>
        </FileUploader>

        {sheet && (
          <>
            <Text>
              {t("import.columns", { columns: usedColumns })} {sheet.byAi && t("import.columnsByAi")}
            </Text>
            {notUsed.length > 0 && (
              <MessageStrip design="Critical" hideCloseButton>
                {t("import.notUsed", { columns: notUsed.join(", ") })}
              </MessageStrip>
            )}
            <Table
              accessibleName={t("import.title")}
              overflowMode="Popin"
              headerRow={
                <TableHeaderRow>
                  <TableHeaderCell width="3rem" />
                  <TableHeaderCell width="4rem">{t("import.row")}</TableHeaderCell>
                  <TableHeaderCell minWidth="10rem">{t("field.person")}</TableHeaderCell>
                  <TableHeaderCell minWidth="10rem">{t("field.skill")}</TableHeaderCell>
                  <TableHeaderCell width="7rem">{t("field.level")}</TableHeaderCell>
                  <TableHeaderCell width="7rem">{t("field.validFrom")}</TableHeaderCell>
                  <TableHeaderCell width="7rem">{t("field.validTo")}</TableHeaderCell>
                  <TableHeaderCell minWidth="12rem">{t("import.result")}</TableHeaderCell>
                </TableHeaderRow>
              }
            >
              {rows.map((row) => (
                <TableRow key={row.line} rowKey={String(row.line)}>
                  <TableCell>
                    <CheckBox
                      accessibleName={t("import.select", { line: row.line })}
                      checked={!row.problem && !skipped.includes(row.line)}
                      disabled={busy || row.problem !== null}
                      onChange={() => setSkipped(skipped.includes(row.line) ? skipped.filter((line) => line !== row.line) : [...skipped, row.line])}
                    />
                  </TableCell>
                  <TableCell>
                    <Text>{row.line}</Text>
                  </TableCell>
                  <TableCell>
                    <Text>{row.personText}</Text>
                  </TableCell>
                  <TableCell>
                    <Text>{row.skillText}</Text>
                  </TableCell>
                  <TableCell>
                    <Text>{levelName(row.levelId)}</Text>
                  </TableCell>
                  <TableCell>
                    <Text>{row.startDate ? formatDate(row.startDate) : ""}</Text>
                  </TableCell>
                  <TableCell>
                    <Text>{row.endDate ? formatDate(row.endDate) : ""}</Text>
                  </TableCell>
                  <TableCell>
                    <ObjectStatus state={row.problem ? "Negative" : "Positive"}>
                      {row.problem ? t(row.problem.key, row.problem.params) : t("import.ready")}
                    </ObjectStatus>
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </>
        )}
      </div>
    </Dialog>
  );
}
