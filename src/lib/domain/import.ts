// Turning the rows of a spreadsheet into assignments to create. Pure rules: the file is read
// elsewhere, and nothing here writes.
import type { Message } from "@/lib/i18n/translate";
import { isIsoDate, validateValidity } from "./status";

export const MAX_IMPORT_ROWS = 20;

export const IMPORT_FIELDS = ["person", "skill", "level", "validFrom", "validTo"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
// Which column of the sheet holds which field. Person and skill are needed, the rest is optional.
export type ColumnMap = Record<ImportField, number | null>;

// Usual column titles in English and German. Anything else is left to the AI or the user.
const TITLES: Record<ImportField, string[]> = {
  person: ["person", "name", "technician", "employee", "mitarbeiter", "techniker"],
  skill: ["skill", "qualification", "qualifikation"],
  level: ["level", "stufe", "niveau"],
  validFrom: ["valid from", "from", "start", "start date", "gültig ab", "gültig von", "von"],
  validTo: ["valid to", "valid until", "to", "until", "expiry", "expiry date", "end", "end date", "gültig bis", "bis", "ablaufdatum"],
};

const clean = (title: string | null) => (title ?? "").trim().toLowerCase();

// Each field gets the first column with one of the given titles. A column is used once.
function findColumns(headers: string[], titlesOf: (field: ImportField) => string[]): ColumnMap {
  const used = new Set<number>();
  const columns = {} as ColumnMap;
  for (const field of IMPORT_FIELDS) {
    const titles = titlesOf(field).filter(Boolean);
    const index = headers.findIndex((header, column) => !used.has(column) && titles.includes(clean(header)));
    columns[field] = index === -1 ? null : index;
    if (index !== -1) used.add(index);
  }
  return columns;
}

export function guessColumns(headers: string[]): ColumnMap {
  return findColumns(headers, (field) => TITLES[field]);
}

// The AI answers with header texts. Only a header that is in the sheet becomes a column.
export function columnsFromHeaders(answer: Record<ImportField, string | null>, headers: string[]): ColumnMap {
  return findColumns(headers, (field) => [clean(answer[field])]);
}

// The titles of the columns that no field uses, to tell the user what is ignored.
export function unusedHeaders(headers: string[], columns: ColumnMap): string[] {
  const used = Object.values(columns);
  return headers.filter((header, column) => header.trim() !== "" && !used.includes(column));
}

// Excel puts this invisible mark at the start of a CSV file.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

// A CSV file with comma or semicolon as separator. A value in double quotes can hold the
// separator, a line break and doubled quotes. Empty lines stay, so row numbers match the file.
export function parseCsv(text: string): string[][] {
  const content = text.replace(BYTE_ORDER_MARK, "").replace(/\r\n?/g, "\n");
  const firstLine = content.split("\n")[0];
  const separator = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (quoted && char === '"' && content[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (quoted && char === '"') quoted = false;
    else if (quoted) cell += char;
    else if (char === '"' && cell === "") quoted = true;
    else if (char === separator || char === "\n") {
      row.push(cell);
      cell = "";
      if (char === "\n") {
        rows.push(row);
        row = [];
      }
    } else cell += char;
  }
  if (cell !== "" || row.length > 0) rows.push([...row, cell]);
  return rows;
}

export const isEmptyRow = (row: unknown[]) => row.every((cell) => String(cell ?? "").trim() === "");

// An empty cell is "no date". A date cell of a spreadsheet, 31.12.2027 and 2027-12-31 are
// accepted, anything else is invalid.
export function parseDate(value: unknown): string | null | "invalid" {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "invalid" : value.toISOString().slice(0, 10);
  const text = String(value).trim();
  const swiss = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  const iso = swiss ? `${swiss[3]}-${swiss[2].padStart(2, "0")}-${swiss[1].padStart(2, "0")}` : text;
  return isIsoDate(iso) ? iso : "invalid";
}

export interface ImportContext {
  persons: { id: string; displayName: string; isTechnician: boolean }[];
  skills: { id: string; name: string; scaleId: string | null }[];
  levels: Record<string, { id: string; name: string }[]>; // by scale id
  isAssigned: (personId: string, skillId: string) => boolean;
}

export interface ImportRow {
  line: number; // row in the file, 1 is the header
  personText: string;
  skillText: string;
  personId: string | null;
  skillId: string | null;
  levelId: string | null;
  startDate: string | null;
  endDate: string | null;
  problem: Message | null; // a row with a problem is not imported
}

// Letters and digits of a name in a fixed order, so "Marco Bieri" equals "Bieri, Marco".
const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .sort()
    .join(" ");

// One row of the sheet becomes one proposed assignment, or a row with the reason why not.
// Empty rows are skipped.
export function toImportRows(rows: unknown[][], columns: ColumnMap, context: ImportContext): ImportRow[] {
  const text = (row: unknown[], column: number | null) => (column === null ? "" : String(row[column] ?? "").trim());
  const seen = new Set<string>();
  const result: ImportRow[] = [];

  for (const [index, row] of rows.entries()) {
    if (isEmptyRow(row)) continue;
    const personText = text(row, columns.person);
    const skillText = text(row, columns.skill);
    const levelText = text(row, columns.level);
    const startDate = columns.validFrom === null ? null : parseDate(row[columns.validFrom]);
    const endDate = columns.validTo === null ? null : parseDate(row[columns.validTo]);

    const name = words(personText);
    const matches = name === "" ? [] : context.persons.filter((person) => person.isTechnician && words(person.displayName) === name);
    const skill = context.skills.find((s) => s.name.toLowerCase() === skillText.toLowerCase());
    const level = skill?.scaleId ? context.levels[skill.scaleId]?.find((l) => l.name.toLowerCase() === levelText.toLowerCase()) : undefined;
    const person = matches.length === 1 ? matches[0] : null;
    const key = `${person?.id}|${skill?.id}`;

    let problem: Message | null = null;
    if (matches.length === 0) problem = { key: "import.noPerson" };
    else if (matches.length > 1) problem = { key: "import.manyPersons" };
    else if (!skill) problem = { key: "import.noSkill" };
    else if (levelText && !level) problem = { key: "import.noLevel" };
    else if (startDate === "invalid" || endDate === "invalid") problem = { key: "import.badDate" };
    else problem = validateValidity(startDate, endDate);
    if (!problem && context.isAssigned(person!.id, skill!.id)) problem = { key: "import.alreadyAssigned" };
    else if (!problem && seen.has(key)) problem = { key: "import.twice" };
    if (!problem) seen.add(key);

    result.push({
      line: index + 2,
      personText,
      skillText,
      personId: person?.id ?? null,
      skillId: skill?.id ?? null,
      levelId: level?.id ?? null,
      startDate: startDate === "invalid" ? null : startDate,
      endDate: endDate === "invalid" ? null : endDate,
      problem,
    });
  }
  return result;
}
