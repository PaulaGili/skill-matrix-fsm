/**
 * GET  /api/ai/certificate: tells the UI whether the AI feature is configured.
 * POST /api/ai/certificate: reads one certificate file and returns the facts found on it.
 * The Anthropic key stays on the server, like the FSM secret.
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CertificateNotReadError, readCertificate } from "@/lib/ai/read-certificate";
import { MAX_CERTIFICATE_BYTES, checkCertificateFile } from "@/lib/domain/certificate";

export const dynamic = "force-dynamic";

// A simple guard against a runaway bill: at most this many reads per hour and server.
const MAX_READS_PER_HOUR = 30;
let windowStart = 0;
let reads = 0;

function overLimit(): boolean {
  if (Date.now() - windowStart > 60 * 60 * 1000) {
    windowStart = Date.now();
    reads = 0;
  }
  return ++reads > MAX_READS_PER_HOUR;
}

const Body = z.object({ fileName: z.string().min(1).max(255), base64: z.string().min(1) });

const enabled = () => Boolean(process.env.ANTHROPIC_API_KEY);
const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export function GET() {
  return NextResponse.json({ enabled: enabled() });
}

export async function POST(request: Request) {
  if (!enabled()) return fail(503, "Reading certificates with AI is not configured.");
  // Base64 is a third larger than the file, so anything above this cannot be a valid upload.
  if (Number(request.headers.get("content-length")) > MAX_CERTIFICATE_BYTES * 1.5) return fail(413, "The file is larger than 5 MB.");
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "fileName and base64 are required.");
  const { fileName, base64 } = body.data;
  const check = checkCertificateFile(fileName, Buffer.byteLength(base64, "base64"));
  if (!check.ok) return fail(400, check.error);
  if (overLimit()) return fail(429, "Too many certificates were read in the last hour. Try again later.");

  try {
    return NextResponse.json(await readCertificate(check.type, base64));
  } catch (error) {
    if (error instanceof CertificateNotReadError) return fail(422, error.message);
    if (error instanceof Anthropic.RateLimitError) return fail(429, "The AI service is busy. Try again in a moment.");
    if (error instanceof Anthropic.APIConnectionError) return fail(502, "The AI service is not reachable.");
    if (error instanceof Anthropic.APIError) return fail(502, `The AI service answered with an error (${error.status}).`);
    throw error;
  }
}
