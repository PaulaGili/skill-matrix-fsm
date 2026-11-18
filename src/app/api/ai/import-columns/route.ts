/**
 * POST /api/ai/import-columns: matches the column titles of an import file to the fields of
 * an assignment. Only the titles are sent to the AI, never the rows.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { matchColumns } from "@/lib/ai/import-columns";
import { aiEnabled, fail, failFromAi, overLimit } from "@/lib/ai/server";

export const dynamic = "force-dynamic";

const Body = z.object({ headers: z.array(z.string().max(100)).min(1).max(50) });

export async function POST(request: Request) {
  if (!aiEnabled()) return fail(503, "Matching columns with AI is not configured.");
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "headers is required.");
  if (overLimit()) return fail(429, "Too many AI requests in the last hour. Try again later.");

  try {
    return NextResponse.json(await matchColumns(body.data.headers));
  } catch (error) {
    return failFromAi(error);
  }
}
