import { cellKey, cellPasses, type Cell, type MatrixFilters } from "./matrix";
import { validityHint, type AssignmentStatus, type Validity } from "./status";

type ExportCell = Cell<Validity & { id: string; personId: string; skillId: string; levelName: string | null }>;

// The matrix as it is shown: one row per person, one column per skill. Cells that are not
// assigned or hidden by a filter are empty.
export function matrixTable(
  persons: { id: string; displayName: string }[],
  skills: { id: string; name: string }[],
  cells: Map<string, ExportCell>,
  filters: MatrixFilters,
  statusText: (status: AssignmentStatus) => string,
): string[][] {
  const text = (cell: ExportCell | undefined) => {
    if (!cell || !cellPasses(cell, filters)) return "";
    const parts = [statusText(cell.status), cell.assignment.levelName, validityHint(cell.assignment, cell.status), cell.hasCertificate ? "certificate" : ""];
    return parts.filter(Boolean).join(", ");
  };
  return [
    ["Person", ...skills.map((skill) => skill.name)],
    ...persons.map((person) => [person.displayName, ...skills.map((skill) => text(cells.get(cellKey(person.id, skill.id))))]),
  ];
}

// A spreadsheet runs a cell that starts with one of these as a formula. Skill names are
// typed by users, so such a value gets a leading apostrophe and stays text.
export function safeCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function toCsv(rows: string[][]): string {
  const quote = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
  return rows.map((row) => row.map((value) => quote(safeCell(value))).join(",")).join("\r\n");
}
