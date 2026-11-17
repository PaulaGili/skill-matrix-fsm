"use client";

import { ObjectStatus } from "@ui5/webcomponents-react";
import type { AssignmentStatus } from "@/lib/domain/status";

type State = "None" | "Information" | "Positive" | "Critical" | "Negative";

export const STATUS_LABELS: Record<AssignmentStatus, { text: string; state: State }> = {
  unassigned: { text: "Not assigned", state: "None" },
  notYetValid: { text: "Not yet valid", state: "Information" },
  valid: { text: "Valid", state: "Positive" },
  expiring: { text: "Expiring soon", state: "Critical" },
  expired: { text: "Expired", state: "Negative" },
};

export const STATUS_HELP: Record<AssignmentStatus, string> = {
  unassigned: "The person does not have this skill.",
  notYetValid: "The assignment starts on a date in the future.",
  valid: "No end date, or the end date is more than 30 days away.",
  expiring: "The end date is today or within the next 30 days.",
  expired: "The end date is in the past.",
};

// Colour, icon and text together, so the status never depends on colour alone.
export function StatusBadge({ status }: { status: AssignmentStatus }) {
  const { text, state } = STATUS_LABELS[status];
  return (
    <ObjectStatus state={state} showDefaultIcon={state !== "None"} title={STATUS_HELP[status]}>
      {text}
    </ObjectStatus>
  );
}
