import type { Translate } from "@/lib/i18n/translate";
import { cellKey, cellPasses, type Cell, type MatrixFilters } from "./matrix";
import { validityHint, type Validity } from "./status";

type ExportCell = Cell<Validity & { id: string; personId: string; skillId: string; levelName: string | null }>;

// The matrix as it is shown: one row per person, one column per skill. Cells that are not
// assigned or hidden by a filter are empty. It builds finished texts, so it gets the
// translate function instead of returning messages.
export function matrixTable(
  persons: { id: string; displayName: string }[],
  skills: { id: string; name: string }[],
  cells: Map<string, ExportCell>,
  filters: MatrixFilters,
  t: Translate,
): string[][] {
  const text = (cell: ExportCell | undefined) => {
    if (!cell || !cellPasses(cell, filters)) return "";
    const hint = validityHint(cell.assignment, cell.status);
    const parts = [t(`status.${cell.status}`), cell.assignment.levelName, t(hint.key, hint.params), cell.hasCertificate ? t("export.certificate") : ""];
    return parts.filter(Boolean).join(", ");
  };
  return [
    [t("field.person"), ...skills.map((skill) => skill.name)],
    ...persons.map((person) => [person.displayName, ...skills.map((skill) => text(cells.get(cellKey(person.id, skill.id))))]),
  ];
}

// A spreadsheet that opens a CSV file runs a cell that starts with one of these as a formula.
// Skill names are typed by users, so such a value gets a leading apostrophe and stays text.
// An Excel file stores text cells as text and does not need this.
export function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function toCsv(rows: string[][], separator = ","): string {
  const quote = (value: string) => (/["\r\n]/.test(value) || value.includes(separator) ? `"${value.replaceAll('"', '""')}"` : value);
  return rows.map((row) => row.map((value) => quote(safeCell(value))).join(separator)).join("\r\n");
}
