/**
 * GET  /api/ai/certificate: tells the UI whether the AI features are configured.
 * POST /api/ai/certificate: reads one certificate file and returns the facts found on it.
 * The Anthropic key stays on the server, like the FSM secret.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { CertificateNotReadError, readCertificate } from "@/lib/ai/read-certificate";
import { aiEnabled, fail, failFromAi, overLimit } from "@/lib/ai/server";
import { MAX_CERTIFICATE_BYTES, checkCertificateFile } from "@/lib/domain/certificate";
import { translate } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

const Body = z.object({ fileName: z.string().min(1).max(255), base64: z.string().min(1), skill: z.string().max(512).optional() });

export function GET() {
  return NextResponse.json({ enabled: aiEnabled() });
}

export async function POST(request: Request) {
  if (!aiEnabled()) return fail(503, "Reading certificates with AI is not configured.");
  // Base64 is a third larger than the file, so anything above this cannot be a valid upload.
  if (Number(request.headers.get("content-length")) > MAX_CERTIFICATE_BYTES * 1.5) return fail(413, "The file is larger than 5 MB.");
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "fileName and base64 are required.");
  const { fileName, base64, skill } = body.data;
  const check = checkCertificateFile(fileName, Buffer.byteLength(base64, "base64"));
  if (!check.ok) return fail(400, translate("en", check.error.key));
  if (overLimit()) return fail(429, "Too many certificates were read in the last hour. Try again later.");

  try {
    return NextResponse.json(await readCertificate(check.type, base64, skill));
  } catch (error) {
    if (error instanceof CertificateNotReadError) return fail(422, error.message);
    return failFromAi(error);
  }
}
