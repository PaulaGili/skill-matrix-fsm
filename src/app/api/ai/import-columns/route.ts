/**
 * POST /api/ai/import-columns: matches the column titles of an import file to the fields of
 * an assignment. Only the first row of the file is sent to the AI.
 */
import { z } from "zod";
import { matchColumns } from "@/lib/ai/import-columns";
import { aiRoute } from "@/lib/ai/server";

export const dynamic = "force-dynamic";
// Room for one AI call of up to 25 seconds and one retry.
export const maxDuration = 60;

const Body = z.object({ headers: z.array(z.string().max(100)).min(1).max(50) });

export const POST = aiRoute(Body, ({ headers }) => matchColumns(headers));
