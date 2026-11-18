import { parseCsv } from "@/lib/domain/import";

// The rows of an import file, .csv or .xlsx. The Excel reader is loaded only when it is needed.
export async function readRows(file: File): Promise<unknown[][]> {
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
