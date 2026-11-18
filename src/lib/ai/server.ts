// Server only. What the AI features share: the models, the switch, a usage cap, the call and the route.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import type { z } from "zod";

// One small model for all four features. The evaluation compared it with the strong model
// on the certificates, phone photos included: the same answers, faster and far cheaper.
export const MODEL = "claude-haiku-5-5";

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

// A simple guard against a runaway bill: at most this many AI calls per hour and server.
const MAX_CALLS_PER_HOUR = 60;
const HOUR = 60 * 60 * 1000;
let windowStart = 0;
let calls = 0;

function overLimit(): boolean {
  if (Date.now() - windowStart > HOUR) {
    windowStart = Date.now();
    calls = 0;
  }
  return ++calls > MAX_CALLS_PER_HOUR;
}

class NoAnswerError extends Error {}

// One call for every feature: the answer has to fit the schema, or it is no answer.
export async function ask<T>(system: string, schema: z.ZodType<T>, content: Anthropic.MessageParam["content"], model = MODEL): Promise<T> {
  const response = await new Anthropic({ timeout: 25_000, maxRetries: 1 }).messages.parse({
    model,
    max_tokens: 16000,
    system,
    output_config: { effort: "low", format: zodOutputFormat(schema) },
    messages: [{ role: "user", content }],
  });
  if (!response.parsed_output) throw new NoAnswerError(response.stop_reason ?? "");
  return response.parsed_output;
}

// One shape for every route. The browser shows a translated text by status, see client.ts.
export function aiRoute<B>(Body: z.ZodType<B>, run: (body: B) => Promise<unknown>) {
  return async (request: Request) => {
    if (!aiEnabled()) return fail(503, "AI is not configured.");
    const body = Body.safeParse(await request.json().catch(() => null));
    if (!body.success) return fail(400, "The request is not valid.");
    if (overLimit()) return fail(429, "Too many AI requests in the last hour.");
    try {
      const result = await run(body.data);
      return result instanceof Response ? result : NextResponse.json(result);
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) return fail(429, "The AI service is busy.");
      // A file the model cannot open, or an answer that does not fit the schema.
      if (error instanceof Anthropic.BadRequestError || error instanceof NoAnswerError) return fail(422, "No answer.");
      // Also a wrong key or a bug in this code. The log has the cause.
      console.error("[api/ai]", error);
      return fail(502, "The AI service is not available.");
    }
  };
}
