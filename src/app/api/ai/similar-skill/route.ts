/**
 * POST /api/ai/similar-skill: says whether a new skill name means the same as an existing
 * skill. Only skill names are sent to the AI.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { aiEnabled, fail, failFromAi, overLimit } from "@/lib/ai/server";
import { similarSkill } from "@/lib/ai/similar-skill";

export const dynamic = "force-dynamic";

const Body = z.object({ name: z.string().trim().min(1).max(512), existing: z.array(z.string().max(512)).max(500) });

export async function POST(request: Request) {
  if (!aiEnabled()) return fail(503, "Checking names with AI is not configured.");
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "name and existing are required.");
  if (body.data.existing.length === 0) return NextResponse.json({ similar: null });
  if (overLimit()) return fail(429, "Too many AI requests in the last hour. Try again later.");

  try {
    return NextResponse.json({ similar: await similarSkill(body.data.name, body.data.existing) });
  } catch (error) {
    return failFromAi(error);
  }
}
