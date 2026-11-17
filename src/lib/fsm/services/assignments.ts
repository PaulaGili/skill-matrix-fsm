// Assignments = FSM Skills (a tag given to a person). The Skill Service is the only API
// that carries the proficiency level.
import { assertBulkOk, skillApi, skillSearch } from "@/lib/fsm/client";
import { NAME_PREFIX, isOwnName } from "@/lib/candidate";
import { OPEN_END_DATE, todayIso, validateValidity } from "@/lib/domain/status";
import type { SkillServiceSkill } from "@/lib/fsm/types";
import { OwnershipError } from "./ownership";
import { requireOwnSkill } from "./skills";
import type { Assignment, Skill } from "./model";

export interface AssignmentInput {
  levelId: string | null;
  startDate: string | null;
  endDate: string | null;
}

export class ConflictError extends Error {
  constructor() {
    super("Someone else changed this assignment in the meantime. Reload and try again.");
    this.name = "ConflictError";
  }
}

export function toAssignment(skill: SkillServiceSkill): Assignment {
  return {
    id: skill.id,
    skillId: skill.tagId,
    personId: skill.technicianId,
    startDate: skill.startDate || null,
    endDate: skill.endDate && skill.endDate !== OPEN_END_DATE ? skill.endDate : null,
    levelId: skill.proficiencyId,
    levelName: skill.proficiencyName,
    level: skill.proficiencyLevel,
  };
}

export async function listAssignments(): Promise<Assignment[]> {
  const skills = await skillSearch<SkillServiceSkill & { deleted?: boolean }>("v1/skills", [{ field: "tag.name", operator: "like", value: `${NAME_PREFIX}%` }]);
  return skills.filter((skill) => !skill.deleted && isOwnName(skill.tagName)).map(toAssignment);
}

// Returns FSM's records for these ids and checks that each belongs to the given skill.
export async function requireOwnAssignments(skillId: string, ids: string[]): Promise<{ skill: Skill; assignments: Assignment[] }> {
  const [skill, all] = await Promise.all([requireOwnSkill(skillId), listAssignments()]);
  const assignments = ids.map((id) => {
    const assignment = all.find((a) => a.id === id && a.skillId === skill.id);
    if (!assignment) throw new OwnershipError(`Assignment ${id} is not an assignment of ${skill.name}.`);
    return assignment;
  });
  return { skill, assignments };
}

// FSM requires a start date, so an empty "valid from" means today.
function validDates(input: AssignmentInput): { startDate: string; endDate: string | null } {
  const startDate = input.startDate || todayIso();
  const endDate = input.endDate || null;
  const error = validateValidity(startDate, endDate);
  if (error) throw new Error(error);
  return { startDate, endDate };
}

export async function createAssignment(skillId: string, personId: string, input: AssignmentInput): Promise<Assignment> {
  const { startDate, endDate } = validDates(input);
  const skill = await requireOwnSkill(skillId);
  const body = [
    {
      tagId: skill.id,
      technician: personId,
      startDate,
      ...(endDate ? { endDate } : {}),
      ...(input.levelId ? { proficiencyId: input.levelId } : {}),
    },
  ];
  const [created] = assertBulkOk<SkillServiceSkill>(await skillApi("v2/skills", { method: "POST", body }));
  return toAssignment(created);
}

// `loaded` is the assignment as the user saw it. If FSM's record changed since then, the update
// is refused. FSM ignores a new end date on an open-ended skill unless validityType changes
// with it (LF = date range, PE = no end). The PATCH returns no body, so callers reload.
export async function updateAssignment(skillId: string, loaded: Assignment, input: AssignmentInput): Promise<void> {
  const { startDate, endDate } = validDates(input);
  const { skill, assignments } = await requireOwnAssignments(skillId, [loaded.id]);
  const [current] = assignments;
  if (current.startDate !== loaded.startDate || current.endDate !== loaded.endDate || current.levelId !== loaded.levelId) throw new ConflictError();

  await skillApi(`v1/tags/${skill.id}/skills/${loaded.id}`, {
    method: "PATCH",
    body: { proficiencyId: input.levelId, startDate, endDate: endDate ?? OPEN_END_DATE, validityType: endDate ? "LF" : "PE" },
  });
}

export async function endAssignments(skillId: string, assignmentIds: string[], endDate: string): Promise<void> {
  if (assignmentIds.length === 0) return;
  const { skill, assignments } = await requireOwnAssignments(skillId, assignmentIds);
  for (const assignment of assignments) {
    await skillApi(`v1/tags/${skill.id}/skills/${assignment.id}`, {
      method: "PATCH",
      body: { startDate: assignment.startDate, endDate, validityType: "LF" },
    });
  }
}

// Deletes the FSM Skills only. The app calls removeAssignments() in remove.ts, which
// deletes the certificates first.
export async function deleteAssignments(skillId: string, assignmentIds: string[]): Promise<void> {
  if (assignmentIds.length === 0) return;
  await requireOwnAssignments(skillId, assignmentIds);
  assertBulkOk(await skillApi("v2/skills", { method: "DELETE", body: assignmentIds.map((id) => ({ id })) }));
}
