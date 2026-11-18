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
import { matchImportColumns, readCertificateForImport } from "@/lib/ai/client";
import { CERTIFICATE_ACCEPT, checkCertificateFile } from "@/lib/domain/certificate";
import {
  CERTIFICATE_COLUMNS,
  IMPORT_FIELDS,
  MAX_IMPORT_CERTIFICATES,
  MAX_IMPORT_ROWS,
  certificateRows,
  guessColumns,
  isEmptyRow,
  toImportRows,
  unusedColumns,
  withProposed,
  type CertificateRead,
  type ColumnMap,
  type ImportRow,
} from "@/lib/domain/import";
import { formatDate } from "@/lib/domain/status";
import { fileToBase64 } from "@/lib/fsm/client";
import { toUserMessage } from "@/lib/fsm/errors";
import { createAssignments } from "@/lib/fsm/services/assignments";
import { uploadToChecked } from "@/lib/fsm/services/certificates";
import type { Level, Person, Skill } from "@/lib/fsm/services/model";
import { listLevels } from "@/lib/fsm/services/scale";
import { recordAssigned } from "@/lib/history/store";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { UserError, type Message } from "@/lib/i18n/translate";
import { SortButton, useSort, type SortColumn } from "@/components/common/useSort";
import { readRows } from "./readRows";
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
  askedAi: boolean;
  byAi: boolean; // the AI filled at least one field
  // When the rows were read from certificates: the file of each row, and why it was not read.
  certificates?: { file: File; problem: Message | null }[];
}

const SORT_COLUMNS: SortColumn[] = [
  { key: "line", label: "import.row" },
  { key: "person", label: "field.person" },
  { key: "skill", label: "field.skill" },
  { key: "level", label: "field.level" },
  { key: "validFrom", label: "field.validFrom" },
  { key: "validTo", label: "field.validTo" },
  { key: "result", label: "import.result" },
];

// What a row from a certificate says first: the file was not read, or no name or no skill was found on it.
function certificateProblem(certificate: { problem: Message | null } | undefined, row: ImportRow): Message | null {
  if (!certificate) return null;
  if (certificate.problem) return certificate.problem;
  if (row.personText === "") return { key: "import.noHolder" };
  return row.skillText === "" ? { key: "import.noSkillFound" } : null;
}

// Creates assignments from a file, or from certificates that the AI reads. Every row is shown
// first with what it would create or why it cannot be imported, and only the ticked rows are saved.
export function ImportDialog({ skills, persons, isAssigned, aiEnabled, onClose, onSaved, onChanged }: Props) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const { t } = useI18n();
  const sort = useSort();

  const loadLevels = useCallback(async () => {
    const scaleIds = [...new Set(skills.map((skill) => skill.scaleId).filter((id) => id !== null))];
    const lists = await Promise.all(scaleIds.map(listLevels));
    return Object.fromEntries(scaleIds.map((id, index) => [id, lists[index]])) as Record<string, Level[]>;
  }, [skills]);
  const { data: levels, error: levelsError } = useAsyncData(loadLevels);

  const ready = sheet !== null && sheet.columns.person !== null && sheet.columns.skill !== null;
  const checked = ready && levels ? toImportRows(sheet.rows, sheet.columns, { persons, skills, levels, isAssigned }) : [];
  const fileOf = (line: number) => sheet?.certificates?.[line - 2];
  const rows = checked.map((row) => ({ ...row, problem: certificateProblem(fileOf(row.line), row) ?? row.problem }));
  const chosen = rows.filter((row) => !row.problem && !skipped.includes(row.line));
  const allLevels = Object.values(levels ?? {}).flat();
  const levelName = (levelId: string | null) => allLevels.find((level) => level.id === levelId)?.name ?? "";
  const shownRows = sort.apply(rows, {
    line: (row) => row.line,
    person: (row) => row.personText,
    skill: (row) => row.skillText,
    level: (row) => levelName(row.levelId),
    validFrom: (row) => row.startDate ?? "",
    validTo: (row) => row.endDate ?? "",
    result: (row) => (row.problem ? t(row.problem.key, row.problem.params) : ""),
  });

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
      else setSheet({ headers, rows: body, columns: guessColumns(headers), askedAi: false, byAi: false });
    } catch (e) {
      setError(toUserMessage(e, t));
    }
    setBusy(false);
  }

  // Only on a click: each chosen certificate goes to the AI with the names of the skills. What
  // it reads becomes a row and passes the same checks as a row of a file.
  async function readCertificates(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    setSheet(null);
    setSkipped([]);
    if (files.length > MAX_IMPORT_CERTIFICATES) return setError(t("import.tooManyCertificates", { count: files.length, max: MAX_IMPORT_CERTIFICATES }));
    setBusy(true);
    const names = skills.map((skill) => skill.name);
    const reads: CertificateRead[] = [];
    const certificates: NonNullable<Sheet["certificates"]> = [];
    for (const [index, file] of files.entries()) {
      setReading(t("import.reading", { done: index + 1, count: files.length }));
      const empty = { fileName: file.name, holderName: null, skill: null, validFrom: null, validTo: null };
      const check = checkCertificateFile(file.name, file.size);
      try {
        reads.push(check.ok ? await readCertificateForImport(file, names) : empty);
        certificates.push({ file, problem: check.ok ? null : check.error });
      } catch (e) {
        reads.push(empty);
        certificates.push({ file, problem: e instanceof UserError ? { key: e.key, params: e.params } : { key: "ai.certificateNotRead" } });
      }
    }
    setSheet({ headers: [], rows: certificateRows(reads), columns: CERTIFICATE_COLUMNS, askedAi: true, byAi: false, certificates });
    setReading(null);
    setBusy(false);
  }

  // Only on a click: the titles the code did not recognise go to the AI, which fills the
  // fields that are still open. The rows below the first one stay in the browser.
  async function matchWithAi(sheet: Sheet) {
    setBusy(true);
    setError(null);
    try {
      const left = unusedColumns(sheet.headers, sheet.columns);
      const proposed = await matchImportColumns(left.map((column) => sheet.headers[column]));
      const columns = withProposed(sheet.columns, proposed, left);
      setSheet({ ...sheet, columns, askedAi: true, byAi: IMPORT_FIELDS.some((field) => columns[field] !== sheet.columns[field]) });
    } catch (e) {
      setError(toUserMessage(e, t));
    }
    setBusy(false);
  }

  // One request for all rows. If it fails, the matrix reloads and shows what was saved.
  async function importRows() {
    setBusy(true);
    setError(null);
    try {
      const created = await createAssignments(
        chosen.map((row) => ({ skillId: row.skillId!, personId: row.personId!, levelId: row.levelId, startDate: row.startDate, endDate: row.endDate })),
      );
      const notAttached: string[] = [];
      for (const assignment of created) {
        const skill = skills.find((s) => s.id === assignment.skillId)?.name ?? "";
        recordAssigned(skill, persons.find((person) => person.id === assignment.personId)?.displayName ?? "", assignment);
        // A row that came from a certificate gets its file.
        const row = chosen.find((r) => r.personId === assignment.personId && r.skillId === assignment.skillId);
        const file = row && fileOf(row.line)?.file;
        if (!file) continue;
        const upload = { fileName: file.name, sizeBytes: file.size, base64: await fileToBase64(file) };
        if ((await uploadToChecked(assignment.id, [upload])).length > 0) notAttached.push(file.name);
      }
      if (notAttached.length === 0) return onSaved(t("import.done", { count: created.length }));
      setError(t("import.notAttached", { files: notAttached.join(", ") }));
      setSheet(null);
      setBusy(false);
      onChanged();
    } catch (e) {
      setError(toUserMessage(e, t));
      setBusy(false);
      onChanged();
    }
  }

  const notUsed = sheet && !sheet.certificates ? unusedColumns(sheet.headers, sheet.columns).map((column) => sheet.headers[column]) : [];
  const canAskAi = aiEnabled && sheet !== null && !sheet.askedAi && notUsed.length > 0 && Object.values(sheet.columns).includes(null);
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
        <Text>
          {t("import.intro", { max: MAX_IMPORT_ROWS })} {aiEnabled && t("import.introCertificates", { max: MAX_IMPORT_CERTIFICATES })}
        </Text>
        {levelsError && (
          <MessageStrip design="Negative" hideCloseButton>
            {levelsError}
          </MessageStrip>
        )}
        {error && (
          <MessageStrip design="Negative" hideCloseButton>
            {error}
          </MessageStrip>
        )}
        <div className={styles.actions}>
          <FileUploader hideInput accept=".xlsx,.csv" disabled={busy || !levels} onChange={(event) => choose(event.detail.files?.[0])}>
            <Button icon="upload" disabled={busy || !levels}>
              {t("import.chooseFile")}
            </Button>
          </FileUploader>
          {aiEnabled && (
            <FileUploader
              hideInput
              multiple
              accept={CERTIFICATE_ACCEPT}
              disabled={busy || !levels}
              onChange={(event) => readCertificates([...(event.detail.files ?? [])])}
            >
              <Button icon="ai" disabled={busy || !levels} tooltip={t("import.readCertificatesHelp")}>
                {t("import.readCertificates")}
              </Button>
            </FileUploader>
          )}
        </div>
        {reading && <Text>{reading}</Text>}

        {sheet && !ready && (
          <MessageStrip design="Negative" hideCloseButton>
            {t("import.noColumns")}
          </MessageStrip>
        )}
        {sheet && canAskAi && (
          <Button icon="ai" disabled={busy} tooltip={t("import.matchWithAiHelp")} onClick={() => matchWithAi(sheet)}>
            {t("import.matchWithAi")}
          </Button>
        )}
        {sheet && sheet.askedAi && !sheet.byAi && !sheet.certificates && <Text>{t("import.aiFoundNothing")}</Text>}
        {sheet && ready && (
          <>
            <Text>
              {sheet.certificates ? t("import.fromCertificates") : t("import.columns", { columns: usedColumns })} {sheet.byAi && t("import.columnsByAi")}
            </Text>
            {notUsed.length > 0 && (
              <MessageStrip design="Critical" hideCloseButton>
                {t("import.notUsed", { columns: notUsed.join(", ") })}
              </MessageStrip>
            )}
            <SortButton columns={SORT_COLUMNS} sort={sort} />
            <Table
              accessibleName={t("import.title")}
              overflowMode="Popin"
              headerRow={
                <TableHeaderRow>
                  <TableHeaderCell width="3rem" />
                  <TableHeaderCell width={sheet.certificates ? "10rem" : "4rem"} sortIndicator={sort.indicator("line")}>
                    {t(sheet.certificates ? "import.file" : "import.row")}
                  </TableHeaderCell>
                  <TableHeaderCell minWidth="10rem" sortIndicator={sort.indicator("person")}>
                    {t("field.person")}
                  </TableHeaderCell>
                  <TableHeaderCell minWidth="10rem" sortIndicator={sort.indicator("skill")}>
                    {t("field.skill")}
                  </TableHeaderCell>
                  <TableHeaderCell width="7rem" sortIndicator={sort.indicator("level")}>
                    {t("field.level")}
                  </TableHeaderCell>
                  <TableHeaderCell width="7rem" sortIndicator={sort.indicator("validFrom")}>
                    {t("field.validFrom")}
                  </TableHeaderCell>
                  <TableHeaderCell width="7rem" sortIndicator={sort.indicator("validTo")}>
                    {t("field.validTo")}
                  </TableHeaderCell>
                  <TableHeaderCell minWidth="12rem" sortIndicator={sort.indicator("result")}>
                    {t("import.result")}
                  </TableHeaderCell>
                </TableHeaderRow>
              }
            >
              {shownRows.map((row) => (
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
                    <Text>{fileOf(row.line)?.file.name ?? row.line}</Text>
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
