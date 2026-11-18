/**
 * POST /api/ai/certificate: reads one certificate file and returns the facts found on it.
 * The Anthropic key stays on the server, like the FSM secret.
 */
import { z } from "zod";
import { readCertificate } from "@/lib/ai/read-certificate";
import { aiRoute, fail } from "@/lib/ai/server";
import { MAX_CERTIFICATE_BYTES, checkCertificateFile } from "@/lib/domain/certificate";
import { translate } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";
// Room for one AI call of up to 25 seconds and one retry.
export const maxDuration = 60;

const Body = z.object({ fileName: z.string().min(1).max(255), base64: z.string().min(1), skill: z.string().max(512).optional() });

const read = aiRoute(Body, async ({ fileName, base64, skill }) => {
  const check = checkCertificateFile(fileName, Buffer.byteLength(base64, "base64"));
  if (!check.ok) return fail(400, translate("en", check.error.key));
  return readCertificate(check.type, base64, skill);
});

export function POST(request: Request) {
  // Base64 is a third larger than the file, so anything above this cannot be a valid upload.
  if (Number(request.headers.get("content-length")) > MAX_CERTIFICATE_BYTES * 1.5) return fail(413, "The file is larger than 5 MB.");
  return read(request);
}
