// Server only. What the AI routes share: the model, the switch, a usage cap and error texts.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

// Reading a scanned certificate needs the strong model. The three short text tasks
// (question, skill name, column titles) run on the small one, which is faster and far cheaper.
export const DOCUMENT_MODEL = "claude-opus-5-5";
export const TEXT_MODEL = "claude-haiku-5-5";

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

// A simple guard against a runaway bill: at most this many AI calls per hour and server.
const MAX_CALLS_PER_HOUR = 60;
let windowStart = 0;
let calls = 0;

export function overLimit(): boolean {
  if (Date.now() - windowStart > 60 * 60 * 1000) {
    windowStart = Date.now();
    calls = 0;
  }
  return ++calls > MAX_CALLS_PER_HOUR;
}

export function failFromAi(error: unknown): NextResponse {
  if (error instanceof Anthropic.RateLimitError) return fail(429, "The AI service is busy. Try again in a moment.");
  if (error instanceof Anthropic.APIConnectionError) return fail(502, "The AI service is not reachable.");
  if (error instanceof Anthropic.APIError) return fail(502, `The AI service answered with an error (${error.status}).`);
  throw error;
}
