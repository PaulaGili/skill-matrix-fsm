"use client";

import { useCallback, useState } from "react";
import { Bar, Button, Dialog, FileUploader, MessageStrip, Text } from "@ui5/webcomponents-react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { matchImportColumns } from "@/lib/ai/client";
import { CERTIFICATE_ACCEPT } from "@/lib/domain/certificate";
import { IMPORT_FIELDS, MAX_IMPORT_CERTIFICATES, MAX_IMPORT_ROWS, toImportRows, unusedColumns, withProposed } from "@/lib/domain/import";
import { toUserMessage } from "@/lib/fsm/errors";
import type { Level, Person, Skill } from "@/lib/fsm/services/model";
import { listLevels } from "@/lib/fsm/services/scale";
import { recordAssigned } from "@/lib/history/store";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Message } from "@/lib/i18n/translate";
import { ImportTable } from "./ImportTable";
import { certificateProblem, saveImport, sheetFromCertificates, sheetFromFile, type Sheet } from "./importSources";
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

// Creates assignments from a file, or from certificates that the AI reads. Every row is shown
// first with what it would create or why it cannot be imported, and only the ticked rows are saved.
export function ImportDialog({ skills, persons, isAssigned, aiEnabled, onClose, onSaved, onChanged }: Props) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const { t } = useI18n();

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

  // Loads the rows from one of the two sources and shows what went wrong while loading.
  async function load(source: () => Promise<Sheet | Message>) {
    setBusy(true);
    setError(null);
    setSheet(null);
    setSkipped([]);
    try {
      const loaded = await source();
      if ("key" in loaded) setError(t(loaded.key, loaded.params));
      else setSheet(loaded);
    } catch (e) {
      setError(toUserMessage(e, t));
    }
    setReading(null);
    setBusy(false);
  }

  // Only on a click: each chosen certificate goes to the AI with the names of the skills.
  function readCertificates(files: File[]) {
    if (files.length === 0) return;
    if (files.length > MAX_IMPORT_CERTIFICATES) return setError(t("import.tooManyCertificates", { count: files.length, max: MAX_IMPORT_CERTIFICATES }));
    const names = skills.map((skill) => skill.name);
    void load(() => sheetFromCertificates(files, names, (done) => setReading(t("import.reading", { done, count: files.length }))));
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
      const files = new Map(chosen.flatMap((row) => (fileOf(row.line) ? [[row, fileOf(row.line)!.file] as const] : [])));
      const { created, notAttached } = await saveImport(chosen, files);
      for (const assignment of created) {
        const skill = skills.find((s) => s.id === assignment.skillId)?.name ?? "";
        recordAssigned(skill, persons.find((person) => person.id === assignment.personId)?.displayName ?? "", assignment);
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
          <FileUploader
            hideInput
            accept=".xlsx,.csv"
            disabled={busy || !levels}
            onChange={(event) => {
              const file = event.detail.files?.[0];
              if (file) void load(() => sheetFromFile(file));
            }}
          >
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
            <ImportTable
              rows={rows}
              fileNames={sheet.certificates?.map((certificate) => certificate.file.name)}
              levelName={levelName}
              skipped={skipped}
              busy={busy}
              onToggle={(line) => setSkipped(skipped.includes(line) ? skipped.filter((other) => other !== line) : [...skipped, line])}
            />
          </>
        )}
      </div>
    </Dialog>
  );
}
