"use client";

import { Button, Icon } from "@ui5/webcomponents-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { Cell } from "@/lib/domain/matrix";
import { validityHint } from "@/lib/domain/status";
import type { Assignment } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./SkillMatrix.module.css";

interface Props {
  cell: Cell<Assignment> | undefined;
  filteredOut: boolean; // assigned, but it does not match the active filters
  label: string; // person and skill, for screen readers
  onSelect: () => void;
}

export function MatrixCell({ cell, filteredOut, label, onSelect }: Props) {
  const { t } = useI18n();
  if (!cell) {
    return (
      <Button
        design="Transparent"
        className={styles.cellButton}
        tooltip={t("cell.unassignedTitle")}
        accessibleName={t("cell.unassignedLabel", { label })}
        onClick={onSelect}
      >
        <span className={styles.assign}>{t("action.assign")}</span>
      </Button>
    );
  }
  // Left blank so that only the matching cells stand out. It still opens the dialog.
  if (filteredOut) {
    return (
      <Button
        design="Transparent"
        className={styles.cellButton}
        tooltip={t("cell.hidden")}
        accessibleName={t("cell.hiddenLabel", { label })}
        onClick={onSelect}
      />
    );
  }
  const { assignment, status, hasCertificate } = cell;
  const hint = validityHint(assignment, status);
  const full = [assignment.levelName, t(hint.key, hint.params)].filter(Boolean).join(", ");
  // The cell shows the date alone to stay narrow: the status says what the date means.
  const short = [assignment.levelName, hint.params?.date ?? t(hint.key)].filter(Boolean).join(" - ");
  const detail = short.charAt(0).toUpperCase() + short.slice(1);
  return (
    <Button
      design="Transparent"
      className={styles.cellButton}
      tooltip={full}
      accessibleName={t("cell.editLabel", { label, status: t(`status.${status}`) })}
      onClick={onSelect}
    >
      <span className={styles.cellContent}>
        <span className={styles.cellStatus}>
          <StatusBadge status={status} />
          {hasCertificate && <Icon name="attachment" accessibleName={t("cell.hasCertificate")} showTooltip />}
        </span>
        <span className={styles.detail}>{detail}</span>
      </span>
    </Button>
  );
}
