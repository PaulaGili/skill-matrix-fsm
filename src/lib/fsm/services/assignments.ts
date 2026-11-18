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

export const MAX_BULK_ASSIGNMENTS = 20;

// One request for all persons, each with its own dates. The assessment rules allow a few
// dozen records at most. A person who already has the skill is refused, so a retry or a
// second browser tab cannot create a duplicate.
export async function createAssignments(skillId: string, inputs: (AssignmentInput & { personId: string })[]): Promise<Assignment[]> {
  if (inputs.length > MAX_BULK_ASSIGNMENTS) throw new Error(`At most ${MAX_BULK_ASSIGNMENTS} persons can be assigned at once.`);
  const dates = inputs.map(validDates);
  const [skill, existing] = await Promise.all([requireOwnSkill(skillId), listAssignments()]);
  const taken = inputs.filter((input) => existing.some((a) => a.skillId === skill.id && a.personId === input.personId));
  if (taken.length > 0) {
    throw new Error(`${taken.length === 1 ? "This person already has" : `${taken.length} of these persons already have`} ${skill.name}. Reload and try again.`);
  }
  const body = inputs.map((input, index) => ({
    tagId: skill.id,
    technician: input.personId,
    startDate: dates[index].startDate,
    ...(dates[index].endDate ? { endDate: dates[index].endDate } : {}),
    ...(input.levelId ? { proficiencyId: input.levelId } : {}),
  }));
  const created = assertBulkOk<SkillServiceSkill>(await skillApi("v2/skills", { method: "POST", body })).map(toAssignment);

  // FSM gives a new skill the default level of the scale, even when none is sent. "No level"
  // therefore needs a second call that clears it.
  for (const [index, assignment] of created.entries()) {
    if (inputs[index].levelId || !assignment.levelId) continue;
    await patchAssignment(skill.id, assignment.id, null, dates[index]);
    created[index] = { ...assignment, levelId: null, levelName: null, level: null };
  }
  return created;
}

export async function createAssignment(skillId: string, personId: string, input: AssignmentInput): Promise<Assignment> {
  const [created] = await createAssignments(skillId, [{ ...input, personId }]);
  return created;
}

// FSM ignores a new end date on an open-ended skill unless validityType changes with it
// (LF = date range, PE = no end). The PATCH returns no body.
async function patchAssignment(tagId: string, id: string, levelId: string | null, dates: { startDate: string; endDate: string | null }): Promise<void> {
  await skillApi(`v1/tags/${tagId}/skills/${id}`, {
    method: "PATCH",
    body: { proficiencyId: levelId, startDate: dates.startDate, endDate: dates.endDate ?? OPEN_END_DATE, validityType: dates.endDate ? "LF" : "PE" },
  });
}

// `loaded` is the assignment as the user saw it. If FSM's record changed since then, the
// update is refused.
export async function updateAssignment(skillId: string, loaded: Assignment, input: AssignmentInput): Promise<void> {
  const { startDate, endDate } = validDates(input);
  const { skill, assignments } = await requireOwnAssignments(skillId, [loaded.id]);
  const [current] = assignments;
  if (current.startDate !== loaded.startDate || current.endDate !== loaded.endDate || current.levelId !== loaded.levelId) throw new ConflictError();

  await patchAssignment(skill.id, loaded.id, input.levelId, { startDate, endDate });
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
