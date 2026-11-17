import { splitForRetire } from "@/lib/domain/retire";
import { addDays, todayIso } from "@/lib/domain/status";
import { deleteAssignments, endAssignments, listAssignments } from "./assignments";
import { deleteCertificatesOf } from "./certificates";
import { deleteSkill } from "./skills";

// FSM keeps an attachment when its skill is deleted, so the certificates go first.
export async function removeAssignments(skillId: string, assignmentIds: string[]): Promise<void> {
  if (assignmentIds.length === 0) return;
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
  await endAssignments(skillId, ids(toEnd), addDays(today, -1));
}
