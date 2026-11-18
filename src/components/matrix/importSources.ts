// Where the rows of an import come from, a spreadsheet or certificates that the AI reads, and
// how the chosen rows are saved.
import { readCertificateForImport } from "@/lib/ai/client";
import { checkCertificateFile } from "@/lib/domain/certificate";
import {
  CERTIFICATE_COLUMNS,
  MAX_IMPORT_ROWS,
  certificateRows,
  guessColumns,
  isEmptyRow,
  type CertificateRead,
  type ColumnMap,
  type ImportRow,
} from "@/lib/domain/import";
import { fileToBase64 } from "@/lib/fsm/client";
import { createAssignments } from "@/lib/fsm/services/assignments";
import { uploadToChecked } from "@/lib/fsm/services/certificates";
import type { Assignment } from "@/lib/fsm/services/model";
import { UserError, type Message } from "@/lib/i18n/translate";
import { readRows } from "./readRows";

export interface Sheet {
  headers: string[];
  rows: unknown[][];
  columns: ColumnMap;
  askedAi: boolean;
  byAi: boolean; // the AI filled at least one field
  // When the rows were read from certificates: the file of each row, and why it was not read.
  certificates?: { file: File; problem: Message | null }[];
}

// The first row of the file holds the titles. A file that cannot be used is answered with the reason.
export async function sheetFromFile(file: File): Promise<Sheet | Message> {
  const [first, ...body] = await readRows(file).catch(() => []);
  const headers = (first ?? []).map((header) => String(header ?? ""));
  const count = body.filter((row) => !isEmptyRow(row)).length;
  if (headers.length === 0 || count === 0) return { key: "import.unreadable" };
  if (count > MAX_IMPORT_ROWS) return { key: "import.tooMany", params: { count, max: MAX_IMPORT_ROWS } };
  return { headers, rows: body, columns: guessColumns(headers), askedAi: false, byAi: false };
}

// Each certificate goes to the AI with the names of the skills, one after the other. What it
// reads becomes a row and passes the same checks as a row of a file.
export async function sheetFromCertificates(files: File[], skillNames: string[], onProgress: (done: number) => void): Promise<Sheet> {
  const reads: CertificateRead[] = [];
  const certificates: NonNullable<Sheet["certificates"]> = [];
  for (const [index, file] of files.entries()) {
    onProgress(index + 1);
    const empty = { fileName: file.name, holderName: null, skill: null, validFrom: null, validTo: null };
    const check = checkCertificateFile(file.name, file.size);
    try {
      reads.push(check.ok ? await readCertificateForImport(file, skillNames) : empty);
      certificates.push({ file, problem: check.ok ? null : check.error });
    } catch (e) {
      reads.push(empty);
      certificates.push({ file, problem: e instanceof UserError ? { key: e.key, params: e.params } : { key: "ai.certificateNotRead" } });
    }
  }
  return { headers: [], rows: certificateRows(reads), columns: CERTIFICATE_COLUMNS, askedAi: true, byAi: false, certificates };
}

// What a row from a certificate says first: the file was not read, or no name or no skill was found on it.
export function certificateProblem(certificate: { problem: Message | null } | undefined, row: ImportRow): Message | null {
  if (!certificate) return null;
  if (certificate.problem) return certificate.problem;
  if (row.personText === "") return { key: "import.noHolder" };
  return row.skillText === "" ? { key: "import.noSkillFound" } : null;
}

// One request creates all assignments. A row that came from a certificate then gets its file.
// A file that could not be attached is named, and its assignment stays.
export async function saveImport(rows: ImportRow[], files: Map<ImportRow, File>): Promise<{ created: Assignment[]; notAttached: string[] }> {
  const created = await createAssignments(
    rows.map((row) => ({ skillId: row.skillId!, personId: row.personId!, levelId: row.levelId, startDate: row.startDate, endDate: row.endDate })),
  );
  const notAttached: string[] = [];
  for (const assignment of created) {
    const row = rows.find((r) => r.personId === assignment.personId && r.skillId === assignment.skillId);
    const file = row && files.get(row);
    if (!file) continue;
    const upload = { fileName: file.name, sizeBytes: file.size, base64: await fileToBase64(file) };
    if ((await uploadToChecked(assignment.id, [upload])).length > 0) notAttached.push(file.name);
  }
  return { created, notAttached };
}
