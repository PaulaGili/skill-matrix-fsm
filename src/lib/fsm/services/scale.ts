// Our proficiency scale in the Skill Service: <candidate>::Levels with three levels.
import { skillApi, skillSearch } from "@/lib/fsm/client";
import { toScopedName } from "@/lib/candidate";
import type { SkillServiceProficiency, SkillServiceScale } from "@/lib/fsm/types";
import { assertOwnName } from "./ownership";
import type { Level, LevelScale } from "./model";

export const SCALE_NAME = toScopedName("Levels");
const LEVEL_NAMES = ["Basic", "Advanced", "Expert"];

export async function findOwnScales(): Promise<SkillServiceScale[]> {
  const scales = await skillSearch<SkillServiceScale>("v1/scales", [{ field: "name", operator: "=", value: SCALE_NAME }]);
  return scales.filter((scale) => scale.name === SCALE_NAME && !scale.deleted).sort((a, b) => a.id.localeCompare(b.id));
}

export async function listLevels(scaleId: string): Promise<Level[]> {
  const levels = await skillSearch<SkillServiceProficiency>(`v1/scales/${scaleId}/proficiencies`);
  return levels.map((p) => ({ id: p.id, name: p.name, level: p.level })).sort((a, b) => a.level - b.level);
}

async function loadScale(id: string): Promise<LevelScale> {
  return { id, levels: await listLevels(id) };
}

export async function findLevelScale(): Promise<LevelScale | null> {
  const [scale] = await findOwnScales();
  return scale ? loadScale(scale.id) : null;
}

// Looks the scale up by name first, so calling this twice never creates a second one.
export async function ensureLevelScale(): Promise<LevelScale> {
  const existing = await findLevelScale();
  if (existing) return existing;

  assertOwnName(SCALE_NAME, "scale");
  const id = await skillApi<string>("v1/scales", {
    method: "POST",
    body: { name: SCALE_NAME, proficiencies: LEVEL_NAMES.map((name, index) => ({ name, isDefault: index === 0 })) },
  });
  return loadScale(id);
}

export async function deleteScale(scale: SkillServiceScale): Promise<void> {
  assertOwnName(scale.name, "scale");
  await skillApi("v2/scales", { method: "DELETE", body: { id: scale.id } });
}
