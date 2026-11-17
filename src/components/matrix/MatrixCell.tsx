"use client";

import { Icon } from "@ui5/webcomponents-react";
import { STATUS_LABELS, StatusBadge } from "@/components/common/StatusBadge";
import type { Cell } from "@/lib/domain/matrix";
import { validityHint } from "@/lib/domain/status";
import type { Assignment } from "@/lib/fsm/services/model";
import styles from "./SkillMatrix.module.css";

interface Props {
  cell: Cell<Assignment> | undefined;
  filteredOut: boolean; // assigned, but it does not match the active filters
  label: string; // person and skill, for screen readers
  onSelect: () => void;
}

export function MatrixCell({ cell, filteredOut, label, onSelect }: Props) {
  if (!cell) {
    return (
      <button
        type="button"
        className={styles.cellButton}
        title="Not assigned. Click to assign."
        aria-label={`${label}: not assigned. Assign`}
        onClick={onSelect}
      >
        <span className={styles.unassigned}>-</span>
        <span className={styles.assign}>Assign</span>
      </button>
    );
  }
  // Left blank so that only the matching cells stand out. It still opens the dialog.
  if (filteredOut) {
    return <button type="button" className={styles.cellButton} title="Hidden by the filter" aria-label={`${label}: hidden by the filter`} onClick={onSelect} />;
  }
  const { assignment, status, hasCertificate } = cell;
  const detail = [assignment.levelName, validityHint(assignment, status)].filter(Boolean).join(", ");
  return (
    <button type="button" className={styles.cellButton} aria-label={`${label}: ${STATUS_LABELS[status].text}. Edit`} onClick={onSelect}>
      <span className={styles.cellStatus}>
        <StatusBadge status={status} />
        {hasCertificate && <Icon name="attachment" accessibleName="Has certificate" showTooltip />}
      </span>
      <span className={styles.detail}>{detail}</span>
    </button>
  );
}
