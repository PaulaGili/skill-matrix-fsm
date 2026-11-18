"use client";

import { useState, type ReactNode } from "react";
import { Toolbar, ToolbarButton } from "@ui5/webcomponents-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import shell from "./AppShell.module.css";
import { useExport } from "./ExportDialog";
import { SortDialog, useSort, type SortColumn } from "./useSort";

interface Props {
  name: string; // start of the export file name
  getRows: () => string[][];
  canExport: boolean;
  loading?: boolean;
  onRefresh?: () => void; // without it the toolbar has no Refresh
  onError: (message: string) => void;
  sorting?: { columns: SortColumn[]; sort: ReturnType<typeof useSort> }; // adds a Sort button
  children?: ReactNode; // the actions of this page, before Sort, Export and Refresh
}

// The actions of a page or of a table in a UI5 toolbar. Export and Refresh always sit in
// its overflow menu, so only the main action is shown.
export function PageToolbar({ name, getRows, canExport, loading, onRefresh, onError, sorting, children }: Props) {
  const [sortOpen, setSortOpen] = useState(false);
  const exporter = useExport({ name, getRows, onError });
  const { t } = useI18n();
  return (
    <>
      <Toolbar className={shell.toolbar} design="Transparent" alignContent="End">
        {children}
        {sorting && <ToolbarButton icon="sort" text={t("action.sort")} onClick={() => setSortOpen(true)} />}
        {canExport && <ToolbarButton overflowPriority="AlwaysOverflow" icon="download" text={t("action.export")} onClick={exporter.open} />}
        {onRefresh && <ToolbarButton overflowPriority="AlwaysOverflow" icon="refresh" text={t("action.refresh")} disabled={loading} onClick={onRefresh} />}
      </Toolbar>
      {exporter.dialog}
      {sorting && <SortDialog columns={sorting.columns} sort={sorting.sort} open={sortOpen} onClose={() => setSortOpen(false)} />}
    </>
  );
}
