"use client";

import { Icon } from "@ui5/webcomponents-react";
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
      <button
        type="button"
        className={styles.cellButton}
        title={t("cell.unassignedTitle")}
        aria-label={t("cell.unassignedLabel", { label })}
        onClick={onSelect}
      >
        <span className={styles.assign}>{t("action.assign")}</span>
      </button>
    );
  }
  // Left blank so that only the matching cells stand out. It still opens the dialog.
  if (filteredOut) {
    return <button type="button" className={styles.cellButton} title={t("cell.hidden")} aria-label={t("cell.hiddenLabel", { label })} onClick={onSelect} />;
  }
  const { assignment, status, hasCertificate } = cell;
  const hint = validityHint(assignment, status);
  const detail = [assignment.levelName, t(hint.key, hint.params)].filter(Boolean).join(", ");
  return (
    <button type="button" className={styles.cellButton} aria-label={t("cell.editLabel", { label, status: t(`status.${status}`) })} onClick={onSelect}>
      <span className={styles.cellStatus}>
        <StatusBadge status={status} />
        {hasCertificate && <Icon name="attachment" accessibleName={t("cell.hasCertificate")} showTooltip />}
      </span>
      <span className={styles.detail}>{detail}</span>
    </button>
  );
}
