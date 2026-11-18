// Skill catalogue = FSM Tags in our namespace. The Skill Service is the only API that
// reads and writes the tag's scale.
import { FsmError, assertBulkOk, skillApi, skillSearch } from "@/lib/fsm/client";
import { NAME_PREFIX, fromScopedName, isOwnName, toScopedName } from "@/lib/candidate";
import { UserError, type Message } from "@/lib/i18n/translate";
import type { SkillServiceTag } from "@/lib/fsm/types";
import { OwnershipError, assertOwnName } from "./ownership";
import type { Skill } from "./model";

export class SkillInUseError extends UserError {
  constructor(name: string) {
    super({ key: "error.skillInUse", params: { name } });
    this.name = "SkillInUseError";
  }
}

export function toSkill(tag: SkillServiceTag): Skill {
  return {
    id: tag.id,
    fsmName: tag.name,
    name: fromScopedName(tag.name),
    description: tag.description?.trim() || null, // FSM returns " " for an empty description
    scaleId: tag.scaleId,
  };
}

export async function listSkills(): Promise<Skill[]> {
  const tags = await skillSearch<SkillServiceTag>("v1/tags", [{ field: "name", operator: "like", value: `${NAME_PREFIX}%` }]);
  return tags
    .filter((tag) => !tag.deleted && isOwnName(tag.name))
    .map(toSkill)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Writes use the record FSM returns for this id, never the caller's copy, so a stale or
// wrong object cannot point a write at someone else's tag.
export async function requireOwnSkill(id: string): Promise<Skill> {
  const skill = (await listSkills()).find((s) => s.id === id);
  if (!skill) throw new OwnershipError({ key: "error.skillGone", params: { id } });
  return skill;
}

export function skillNameError(name: string): Message | null {
  const trimmed = name.trim();
  if (!trimmed) return { key: "skill.nameRequired" };
  if (trimmed.includes("::")) return { key: "skill.nameSeparator" };
  if (NAME_PREFIX.length + trimmed.length > 512) return { key: "skill.nameTooLong" };
  return null;
}

function scopedName(name: string): string {
  const error = skillNameError(name);
  if (error) throw new UserError(error);
  return toScopedName(name);
}

export async function createSkill(input: { name: string; description?: string | null; scaleId: string }): Promise<Skill> {
  const name = scopedName(input.name);
  assertOwnName(name, "skill");
  const body = [{ name, description: input.description?.trim() || undefined, scaleId: input.scaleId }];
  const [tag] = assertBulkOk<SkillServiceTag>(await skillApi("v2/tags", { method: "POST", body }));
  return toSkill(tag);
}

// The bulk endpoint updates the tag when the item carries an id.
export async function updateSkill(id: string, changes: { name: string; description?: string | null }): Promise<Skill> {
  const name = scopedName(changes.name);
  const skill = await requireOwnSkill(id);
  const body = [{ id: skill.id, name, description: changes.description?.trim() || " ", scaleId: skill.scaleId ?? undefined }];
  const [tag] = assertBulkOk<SkillServiceTag>(await skillApi("v2/tags", { method: "POST", body }));
  return toSkill(tag);
}

// FSM refuses to delete a tag that still has skills.
export async function deleteSkill(id: string): Promise<void> {
  const skill = await requireOwnSkill(id);
  try {
    assertBulkOk(await skillApi("v2/tags", { method: "DELETE", body: [{ id: skill.id }] }));
  } catch (error) {
    if (error instanceof FsmError && /linked to one or more skills/i.test(error.message)) throw new SkillInUseError(skill.name);
    throw error;
  }
}
