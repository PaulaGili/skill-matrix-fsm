// Takes a change back by writing the opposite change to FSM. It goes through the same
// services as any other save, so the ownership and conflict checks apply.
import type { Change, Snapshot } from "@/lib/domain/history";
import { createAssignment, updateAssignment } from "@/lib/fsm/services/assignments";
import type { Assignment } from "@/lib/fsm/services/model";
import { removeAssignments } from "@/lib/fsm/services/remove";

const asAssignment = (change: Change, snapshot: Snapshot): Assignment => ({
  id: change.assignmentId,
  skillId: change.skillId,
  personId: change.personId,
  level: null,
  ...snapshot,
});

export async function undoChange(change: Change): Promise<void> {
  const { before, after } = change;
  if (before && after) {
    // Refused with a conflict if someone changed the assignment after this edit.
    await updateAssignment(change.skillId, asAssignment(change, after), before);
  } else if (after) {
    await removeAssignments(change.skillId, [change.assignmentId]);
  } else if (before) {
    // A new assignment with the old values. Its certificates were deleted and stay gone.
    await createAssignment(change.skillId, change.personId, before);
  }
}
