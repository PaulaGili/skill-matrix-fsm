"use client";

import { ObjectStatus } from "@ui5/webcomponents-react";
import type { AssignmentStatus } from "@/lib/domain/status";
import { useI18n } from "@/lib/i18n/I18nProvider";

type State = "None" | "Information" | "Positive" | "Critical" | "Negative";

const STATUS_STATES: Record<AssignmentStatus, State> = {
  unassigned: "None",
  notYetValid: "Information",
  valid: "Positive",
  expiring: "Critical",
  expired: "Negative",
};

// Colour, icon and text together, so the status never depends on colour alone.
export function StatusBadge({ status }: { status: AssignmentStatus }) {
  const { t } = useI18n();
  const state = STATUS_STATES[status];
  return (
    <ObjectStatus state={state} showDefaultIcon={state !== "None"} title={t(`statusHelp.${status}`)}>
      {t(`status.${status}`)}
    </ObjectStatus>
  );
}
