/**
 * POST /api/ai/question: turns a question about the matrix into filter values.
 * Only the question and the names of skills and levels are sent to the AI.
 */
import { z } from "zod";
import { questionToAnswer } from "@/lib/ai/question";
import { aiRoute } from "@/lib/ai/server";

export const dynamic = "force-dynamic";
// Room for one AI call of up to 25 seconds and one retry.
export const maxDuration = 60;

const Body = z.object({
  question: z.string().trim().min(1).max(300),
  skills: z.array(z.string().max(512)).max(500),
  levels: z.array(z.string().max(100)).max(50),
});

export const POST = aiRoute(Body, ({ question, skills, levels }) => questionToAnswer(question, skills, levels));
