"use client";

import { useState } from "react";
import { Bar, Button, CheckBox, Dialog, Label, Option, RadioButton, Select } from "@ui5/webcomponents-react";
import { toCsv } from "@/lib/domain/export";
import { todayIso } from "@/lib/domain/status";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./ExportDialog.module.css";

interface Props {
  name: string; // start of the file name, the date is added
  getRows: () => string[][]; // the table as shown, header row first
  onError: (message: string) => void;
}

// Makes Excel read the CSV file as UTF-8.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

function download(blob: Blob, fileName: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

const SEPARATORS = [
  { text: "export.comma", value: "," },
  { text: "export.semicolon", value: ";" },
  { text: "export.tab", value: "\t" },
] as const;

interface Choice {
  skipped: string[]; // names of the columns to leave out
  format: "xlsx" | "csv";
  separator: string; // only used by CSV, an Excel file has no separator
}

const DEFAULTS: Choice = { skipped: [], format: "xlsx", separator: "," };

// The last choice is kept in the browser. If storage is not available, the defaults are used.
function loadChoice(name: string): Choice {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(`export:${name}`) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

function saveChoice(name: string, choice: Choice) {
  try {
    localStorage.setItem(`export:${name}`, JSON.stringify(choice));
  } catch {}
}

// The Export button and its dialog: choose the columns, then the format.
export function ExportButton({ name, getRows, onError }: Props) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [choice, setChoice] = useState(DEFAULTS);
  const { t } = useI18n();
  const { skipped, format, separator } = choice;
  const fileName = `${name}-${todayIso()}`;

  async function exportFile() {
    const header = rows![0];
    const chosen = rows!.map((row) => row.filter((_, column) => !skipped.includes(header[column])));
    saveChoice(name, choice);
    try {
      if (format === "csv") {
        download(new Blob([BYTE_ORDER_MARK, toCsv(chosen, separator)], { type: "text/csv;charset=utf-8" }), `${fileName}.csv`);
      } else {
        const { default: writeExcelFile } = await import("write-excel-file/browser");
        const bold = chosen[0].map((value) => ({ value, fontWeight: "bold" as const }));
        await writeExcelFile([bold, ...chosen.slice(1)], { columns: chosen[0].map(() => ({ width: 32 })), stickyRowsCount: 1 }).toFile(`${fileName}.xlsx`);
      }
      setRows(null);
    } catch {
      onError(t("export.failed"));
    }
  }

  const nothingChosen = rows !== null && rows[0].every((column) => skipped.includes(column));
  const allChosen = rows !== null && !rows[0].some((column) => skipped.includes(column));
  return (
    <>
      <Button
        design="Transparent"
        icon="download"
        tooltip={t("export.tooltip")}
        onClick={() => {
          setChoice(loadChoice(name));
          setRows(getRows());
        }}
      >
        {t("action.export")}
      </Button>
      {rows && (
        <Dialog
          open
          headerText={t("export.title")}
          onClose={() => setRows(null)}
          footer={
            <Bar
              design="Footer"
              endContent={
                <>
                  <Button design="Emphasized" disabled={nothingChosen} onClick={exportFile}>
                    {t("action.export")}
                  </Button>
                  <Button design="Transparent" onClick={() => setRows(null)}>
                    {t("action.cancel")}
                  </Button>
                </>
              }
            />
          }
        >
          <div className={styles.columns}>
            <Label>{t("export.columns", { count: rows.length - 1 })}</Label>
            <CheckBox
              text={t("export.allColumns")}
              checked={!nothingChosen}
              indeterminate={!nothingChosen && !allChosen}
              onChange={() => setChoice({ ...choice, skipped: allChosen ? [...rows[0]] : skipped.filter((column) => !rows[0].includes(column)) })}
            />
            {rows[0].map((column, index) => (
              <CheckBox
                key={index}
                className={styles.column}
                text={column}
                checked={!skipped.includes(column)}
                onChange={() =>
                  setChoice({ ...choice, skipped: skipped.includes(column) ? skipped.filter((other) => other !== column) : [...skipped, column] })
                }
              />
            ))}
            <Label className={styles.separator}>{t("export.format")}</Label>
            <RadioButton name="export-format" text="Excel (.xlsx)" checked={format === "xlsx"} onChange={() => setChoice({ ...choice, format: "xlsx" })} />
            <RadioButton name="export-format" text="CSV (.csv)" checked={format === "csv"} onChange={() => setChoice({ ...choice, format: "csv" })} />
            {format === "csv" && (
              <>
                <Label for="csv-separator" className={styles.separator}>
                  {t("export.csvSeparator")}
                </Label>
                <Select id="csv-separator" onChange={(event) => setChoice({ ...choice, separator: event.detail.selectedOption.dataset.value ?? "," })}>
                  {SEPARATORS.map((option) => (
                    <Option key={option.text} data-value={option.value} selected={option.value === separator}>
                      {t(option.text)}
                    </Option>
                  ))}
                </Select>
              </>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
