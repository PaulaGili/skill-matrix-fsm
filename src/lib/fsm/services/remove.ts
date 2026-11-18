import { splitForRetire } from "@/lib/domain/retire";
import { addDays, todayIso } from "@/lib/domain/status";
import { deleteAssignments, endAssignments, listAssignments, requireOwnAssignments } from "./assignments";
import { deleteCertificatesOf } from "./certificates";
import { deleteSkill } from "./skills";

// FSM keeps an attachment when its skill is deleted, so the certificates go first. The
// assignments are checked before anything is deleted.
export async function removeAssignments(skillId: string, assignmentIds: string[]): Promise<void> {
  if (assignmentIds.length === 0) return;
  await requireOwnAssignments(skillId, assignmentIds);
  await deleteCertificatesOf(assignmentIds);
  await deleteAssignments(skillId, assignmentIds);
}

export async function deleteSkillWithAssignments(skillId: string): Promise<void> {
  const ids = (await listAssignments()).filter((a) => a.skillId === skillId).map((a) => a.id);
  await removeAssignments(skillId, ids);
  await deleteSkill(skillId);
}

// Keeps the skill, its history and its certificates. See splitForRetire for the rule.
export async function retireSkill(skillId: string): Promise<void> {
  const today = todayIso();
  const assignments = (await listAssignments()).filter((a) => a.skillId === skillId);
  const { toEnd, toRemove } = splitForRetire(assignments, today);
  const ids = (list: typeof assignments) => list.map((a) => a.id);

  await removeAssignments(skillId, ids(toRemove));
  // An assignment that started today cannot end yesterday, so today is its last valid day.
  await endAssignments(skillId, ids(toEnd.filter((a) => a.startDate === today)), today);
  await endAssignments(skillId, ids(toEnd.filter((a) => a.startDate !== today)), addDays(today, -1));
}
