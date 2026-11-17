"use client";

import { useState } from "react";
import { Button, Menu, MenuItem } from "@ui5/webcomponents-react";
import { safeCell, toCsv } from "@/lib/domain/export";
import { todayIso } from "@/lib/domain/status";

interface Props {
  getRows: () => string[][]; // the matrix as shown, header row first
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

export function ExportMenu({ getRows, onError }: Props) {
  const [open, setOpen] = useState(false);
  const fileName = `skill-matrix-${todayIso()}`;

  async function exportAs(format: string | undefined) {
    try {
      if (format === "csv") {
        download(new Blob([BYTE_ORDER_MARK, toCsv(getRows())], { type: "text/csv;charset=utf-8" }), `${fileName}.csv`);
      } else {
        const { default: writeExcelFile } = await import("write-excel-file/browser");
        const rows = getRows().map((row) => row.map(safeCell));
        const header = rows[0].map((value) => ({ value, fontWeight: "bold" as const }));
        await writeExcelFile([header, ...rows.slice(1)], { columns: rows[0].map(() => ({ width: 32 })), stickyRowsCount: 1 }).toFile(`${fileName}.xlsx`);
      }
    } catch {
      onError("The export failed. Try again.");
    }
  }

  return (
    <>
      <Button id="export-button" icon="download" tooltip="Download the matrix as it is shown" onClick={() => setOpen(true)}>
        Export
      </Button>
      <Menu opener="export-button" open={open} onClose={() => setOpen(false)} onItemClick={(event) => exportAs(event.detail.item.dataset.format)}>
        <MenuItem text="Excel (.xlsx)" data-format="xlsx" />
        <MenuItem text="CSV (.csv)" data-format="csv" />
      </Menu>
    </>
  );
}
