// Assignments = FSM Skills (a tag given to a person). The Skill Service is the only API
// that carries the proficiency level.
import { assertBulkOk, skillApi, skillSearch } from "@/lib/fsm/client";
import { NAME_PREFIX, isOwnName } from "@/lib/candidate";
import { MAX_IMPORT_ROWS } from "@/lib/domain/import";
import { OPEN_END_DATE, todayIso, validateValidity } from "@/lib/domain/status";
import { UserError } from "@/lib/i18n/translate";
import type { SkillServiceSkill } from "@/lib/fsm/types";
import { OwnershipError } from "./ownership";
import { listSkills, requireOwnSkill } from "./skills";
import type { Assignment, Skill } from "./model";

export interface AssignmentInput {
  levelId: string | null;
  startDate: string | null;
  endDate: string | null;
}

export class ConflictError extends UserError {
  constructor() {
    super({ key: "error.assignmentConflict" });
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
    if (!assignment) throw new OwnershipError({ key: "error.notAssignmentOfSkill", params: { id, skill: skill.name } });
    return assignment;
  });
  return { skill, assignments };
}

// FSM requires a start date, so an empty "valid from" means today.
function validDates(input: AssignmentInput): { startDate: string; endDate: string | null } {
  const startDate = input.startDate || todayIso();
  const endDate = input.endDate || null;
  const error = validateValidity(startDate, endDate);
  if (error) throw new UserError(error);
  return { startDate, endDate };
}

// The import goes through createAssignments, so both share one limit.
export const MAX_BULK_ASSIGNMENTS = MAX_IMPORT_ROWS;

export type NewAssignment = AssignmentInput & { skillId: string; personId: string };

// One request for all of them, whatever skills and persons they name, each with its own
// dates. The assessment rules allow a few dozen records at most. A person who already has the
// skill is refused, so a retry or a second browser tab cannot create a duplicate.
export async function createAssignments(inputs: NewAssignment[]): Promise<Assignment[]> {
  if (inputs.length > MAX_BULK_ASSIGNMENTS) throw new UserError({ key: "error.tooManyPersons", params: { max: MAX_BULK_ASSIGNMENTS } });
  const dates = inputs.map(validDates);
  const [skills, existing] = await Promise.all([listSkills(), listAssignments()]);
  for (const input of inputs) {
    if (!skills.some((skill) => skill.id === input.skillId)) throw new OwnershipError({ key: "error.skillGone", params: { id: input.skillId } });
  }
  const taken = inputs.filter((input) => existing.some((a) => a.skillId === input.skillId && a.personId === input.personId));
  if (taken.length > 0) {
    // An import can name several skills. The message names the first one and counts its rows.
    const skill = skills.find((s) => s.id === taken[0].skillId)!;
    const count = taken.filter((input) => input.skillId === skill.id).length;
    throw new UserError({ key: "error.alreadyAssigned", params: { count, skill: skill.name } });
  }
  const body = inputs.map((input, index) => ({
    tagId: input.skillId,
    technician: input.personId,
    startDate: dates[index].startDate,
    ...(dates[index].endDate ? { endDate: dates[index].endDate } : {}),
    ...(input.levelId ? { proficiencyId: input.levelId } : {}),
  }));
  const created = assertBulkOk<SkillServiceSkill>(await skillApi("v2/skills", { method: "POST", body })).map(toAssignment);

  // FSM gives every new skill the first level of the scale, whatever is sent. "No level"
  // therefore needs one more call per skill that clears it. They run together and are matched
  // by skill and person, not by position in the answer. If such a call fails, the assignment
  // keeps that level and is returned with it, so the matrix shows what FSM really holds.
  const key = (skillId: string, personId: string) => `${skillId} ${personId}`;
  const noLevel = new Map(inputs.flatMap((input, index) => (input.levelId ? [] : [[key(input.skillId, input.personId), dates[index]] as const])));
  return Promise.all(
    created.map(async (assignment) => {
      const wanted = noLevel.get(key(assignment.skillId, assignment.personId));
      if (!wanted || !assignment.levelId) return assignment;
      try {
        await patchAssignment(assignment.skillId, assignment.id, null, wanted);
        return { ...assignment, levelId: null, levelName: null, level: null };
      } catch {
        return assignment;
      }
    }),
  );
}

export async function createAssignment(skillId: string, personId: string, input: AssignmentInput): Promise<Assignment> {
  const [created] = await createAssignments([{ ...input, skillId, personId }]);
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

// Ends each assignment on the date `endDateOf` gives for it, all in one request. The bulk
// route updates a skill that is sent with its id and keeps its level; checked against FSM.
export async function endAssignments(skillId: string, assignmentIds: string[], endDateOf: (assignment: Assignment) => string): Promise<void> {
  if (assignmentIds.length === 0) return;
  const { skill, assignments } = await requireOwnAssignments(skillId, assignmentIds);
  const body = assignments.map((assignment) => ({
    id: assignment.id,
    tagId: skill.id,
    technician: assignment.personId,
    startDate: assignment.startDate,
    endDate: endDateOf(assignment),
    validityType: "LF",
  }));
  assertBulkOk(await skillApi("v2/skills", { method: "POST", body }));
}

// Deletes the FSM Skills only. The app calls removeAssignments() in remove.ts, which
// deletes the certificates first.
export async function deleteAssignments(skillId: string, assignmentIds: string[]): Promise<void> {
  if (assignmentIds.length === 0) return;
  await requireOwnAssignments(skillId, assignmentIds);
  assertBulkOk(await skillApi("v2/skills", { method: "DELETE", body: assignmentIds.map((id) => ({ id })) }));
}
