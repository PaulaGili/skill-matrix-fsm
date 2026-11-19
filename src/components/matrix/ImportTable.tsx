"use client";

import { CheckBox, ObjectStatus, Table, TableCell, TableHeaderCell, TableHeaderRow, TableRow, Text } from "@ui5/webcomponents-react";
import { SortButton, useSort, type SortColumn } from "@/components/common/useSort";
import type { ImportRow } from "@/lib/domain/import";
import { formatDate } from "@/lib/domain/status";
import { useI18n } from "@/lib/i18n/I18nProvider";

const SORT_COLUMNS: SortColumn[] = [
  { key: "line", label: "import.row" },
  { key: "person", label: "field.person" },
  { key: "skill", label: "field.skill" },
  { key: "level", label: "field.level" },
  { key: "validFrom", label: "field.validFrom" },
  { key: "validTo", label: "field.validTo" },
  { key: "result", label: "import.result" },
];

interface Props {
  rows: ImportRow[];
  fileNames?: string[]; // for rows read from certificates: the file of each row, shown in place of the row number
  levelName: (levelId: string | null) => string;
  skipped: number[]; // lines the user has unticked
  busy: boolean;
  onToggle: (line: number) => void;
}

// The preview of an import: every row with what it would create, or the reason why not.
export function ImportTable({ rows, fileNames, levelName, skipped, busy, onToggle }: Props) {
  const { t } = useI18n();
  const sort = useSort();
  const shownRows = sort.apply(rows, {
    line: (row) => row.line,
    person: (row) => row.personText,
    skill: (row) => row.skillText,
    level: (row) => levelName(row.levelId),
    validFrom: (row) => row.startDate ?? "",
    validTo: (row) => row.endDate ?? "",
    result: (row) => (row.problem ? t(row.problem.key, row.problem.params) : ""),
  });

  return (
    <>
      <SortButton columns={SORT_COLUMNS} sort={sort} />
      <Table
        accessibleName={t("import.title")}
        overflowMode="Popin"
        headerRow={
          <TableHeaderRow>
            <TableHeaderCell width="4.5rem" />
            <TableHeaderCell width={fileNames ? "8rem" : "4rem"} sortIndicator={sort.indicator("line")}>
              {t(fileNames ? "import.file" : "import.row")}
            </TableHeaderCell>
            <TableHeaderCell minWidth="10rem" sortIndicator={sort.indicator("person")}>
              {t("field.person")}
            </TableHeaderCell>
            <TableHeaderCell minWidth="10rem" sortIndicator={sort.indicator("skill")}>
              {t("field.skill")}
            </TableHeaderCell>
            <TableHeaderCell width="7rem" sortIndicator={sort.indicator("level")}>
              {t("field.level")}
            </TableHeaderCell>
            <TableHeaderCell width="7rem" sortIndicator={sort.indicator("validFrom")}>
              {t("field.validFrom")}
            </TableHeaderCell>
            <TableHeaderCell width="7rem" sortIndicator={sort.indicator("validTo")}>
              {t("field.validTo")}
            </TableHeaderCell>
            <TableHeaderCell minWidth="12rem" sortIndicator={sort.indicator("result")}>
              {t("import.result")}
            </TableHeaderCell>
          </TableHeaderRow>
        }
      >
        {shownRows.map((row) => (
          <TableRow key={row.line} rowKey={String(row.line)}>
            <TableCell>
              <CheckBox
                accessibleName={t("import.select", { line: row.line })}
                checked={!row.problem && !skipped.includes(row.line)}
                disabled={busy || row.problem !== null}
                onChange={() => onToggle(row.line)}
              />
            </TableCell>
            <TableCell>
              <Text>{fileNames?.[row.line - 2] ?? row.line}</Text>
            </TableCell>
            <TableCell>
              <Text>{row.personText}</Text>
            </TableCell>
            <TableCell>
              <Text>{row.skillText}</Text>
            </TableCell>
            <TableCell>
              <Text>{levelName(row.levelId)}</Text>
            </TableCell>
            <TableCell>
              <Text>{row.startDate ? formatDate(row.startDate) : ""}</Text>
            </TableCell>
            <TableCell>
              <Text>{row.endDate ? formatDate(row.endDate) : ""}</Text>
            </TableCell>
            <TableCell>
              <ObjectStatus state={row.problem ? "Negative" : "Positive"}>
                {row.problem ? t(row.problem.key, row.problem.params) : t("import.ready")}
              </ObjectStatus>
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </>
  );
}
