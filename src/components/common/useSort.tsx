"use client";

import { useState } from "react";
import { Button, SortItem, ViewSettingsDialog } from "@ui5/webcomponents-react";
import { sortRows } from "@/lib/domain/sort";
import shell from "./AppShell.module.css";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";

type Value = string | number;
export interface SortColumn {
  key: string;
  label?: MessageKey;
  text?: string; // a name from the data, shown as it is
}

// Sorting for the list tables. The order is chosen in the UI5 view settings dialog, and the
// column that sorts shows the arrow.
export function useSort() {
  const [sort, setSort] = useState<{ key: string; descending: boolean } | null>(null);

  function apply<Row>(rows: Row[], values: Record<string, (row: Row) => Value>): Row[] {
    const value = sort && values[sort.key];
    return sort && value ? sortRows(rows, value, sort.descending) : rows;
  }

  const indicator = (key: string) => (sort?.key !== key ? "None" : sort.descending ? "Descending" : "Ascending");
  return { apply, indicator, sort, setSort };
}

type Sort = ReturnType<typeof useSort>;

// The dialog that sets the order of a table. Reset gives the original order back.
// It stays in the page and is only opened: created already open, UI5 shows it without its lists.
export function SortDialog({ columns, sort, open, onClose }: { columns: SortColumn[]; sort: Sort; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <ViewSettingsDialog
      className={shell.offFlow}
      open={open}
      sortDescending={sort.sort?.descending ?? false}
      sortItems={columns.map((column) => (
        <SortItem key={column.key} text={column.text ?? (column.label ? t(column.label) : "")} data-key={column.key} selected={sort.sort?.key === column.key} />
      ))}
      onConfirm={(event) => {
        const key = event.detail.sortByItem?.dataset.key;
        sort.setSort(key ? { key, descending: event.detail.sortDescending } : null);
      }}
      onReset={() => sort.setSort(null)}
      onClose={onClose}
    />
  );
}

// A Sort button with its dialog, for a table that has no toolbar of its own.
export function SortButton({ columns, sort }: { columns: SortColumn[]; sort: Sort }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  return (
    <>
      <Button design="Transparent" icon="sort" onClick={() => setOpen(true)}>
        {t("action.sort")}
      </Button>
      <SortDialog columns={columns} sort={sort} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
