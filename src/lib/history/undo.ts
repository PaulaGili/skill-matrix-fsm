// Takes a change back by writing the opposite change to FSM. It goes through the same
// services as any other save, so the ownership and conflict checks apply.
import type { Change, Snapshot } from "@/lib/domain/history";
import { ConflictError, createAssignment, listAssignments, updateAssignment } from "@/lib/fsm/services/assignments";
import { listCertificates } from "@/lib/fsm/services/certificates";
import type { Assignment } from "@/lib/fsm/services/model";
import { removeAssignments } from "@/lib/fsm/services/remove";
import { UserError } from "@/lib/i18n/translate";

const asAssignment = (change: Change, snapshot: Snapshot): Assignment => ({
  id: change.assignmentId,
  skillId: change.skillId,
  personId: change.personId,
  level: null,
  ...snapshot,
});

// Undoing "assigned" deletes the assignment. That is only done while it is still as it was
// created and has no certificate, because a deleted certificate cannot come back.
async function removeUnchanged(change: Change, created: Snapshot): Promise<void> {
  const [assignments, certificates] = await Promise.all([listAssignments(), listCertificates()]);
  const current = assignments.find((assignment) => assignment.id === change.assignmentId);
  const same = current && current.levelId === created.levelId && current.startDate === created.startDate && current.endDate === created.endDate;
  if (!same) throw new ConflictError();
  if (certificates.some((certificate) => certificate.assignmentId === change.assignmentId)) throw new UserError({ key: "history.hasCertificates" });
  await removeAssignments(change.skillId, [change.assignmentId]);
}

// Answers with the new assignment when undoing a removal created one.
export async function undoChange(change: Change): Promise<Assignment | null> {
  const { before, after } = change;
  if (before && after) {
    // Refused with a conflict if someone changed the assignment after this edit.
    await updateAssignment(change.skillId, asAssignment(change, after), before);
  } else if (after) {
    await removeUnchanged(change, after);
  } else if (before) {
    // A new assignment with the old values. Its certificates were deleted and stay gone.
    return createAssignment(change.skillId, change.personId, before);
  }
  return null;
}
