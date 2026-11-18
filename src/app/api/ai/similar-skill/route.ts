/**
 * POST /api/ai/similar-skill: says whether a new skill name means the same as an existing
 * skill. Only skill names are sent to the AI.
 */
import { z } from "zod";
import { aiRoute } from "@/lib/ai/server";
import { similarSkill } from "@/lib/ai/similar-skill";

export const dynamic = "force-dynamic";
// Room for one AI call of up to 25 seconds and one retry.
export const maxDuration = 60;

const Body = z.object({ name: z.string().trim().min(1).max(512), existing: z.array(z.string().max(512)).max(500) });

export const POST = aiRoute(Body, async ({ name, existing }) => ({ similar: existing.length > 0 ? await similarSkill(name, existing) : null }));
