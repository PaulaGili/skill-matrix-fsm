/**
 * POST /api/ai/question: turns a question about the matrix into filter values.
 * Only the question and the names of skills and levels are sent to the AI, no person data.
 */
import { z } from "zod";
import { NextResponse } from "next/server";
import { questionToAnswer } from "@/lib/ai/question";
import { aiEnabled, fail, failFromAi, overLimit } from "@/lib/ai/server";

export const dynamic = "force-dynamic";

const Body = z.object({
  question: z.string().trim().min(1).max(300),
  skills: z.array(z.string().max(512)).max(500),
  levels: z.array(z.string().max(100)).max(50),
});

export async function POST(request: Request) {
  if (!aiEnabled()) return fail(503, "Asking with AI is not configured.");
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "Enter a question of up to 300 characters.");
  if (overLimit()) return fail(429, "Too many AI requests in the last hour. Try again later.");

  try {
    const { question, skills, levels } = body.data;
    return NextResponse.json(await questionToAnswer(question, skills, levels));
  } catch (error) {
    return failFromAi(error);
  }
}
