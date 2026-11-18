// Certificate file rules, checked before upload. The limit applies to the original file.

import type { Message } from "@/lib/i18n/translate";

export const MAX_CERTIFICATE_BYTES = 5 * 1024 * 1024;
export const CERTIFICATE_ACCEPT = ".pdf,.png,.jpg,.jpeg";

// FSM expects the upper-case extension as Attachment.type, and JPEG for .jpg files.
const FSM_TYPES: Record<string, string> = { pdf: "PDF", png: "PNG", jpg: "JPEG", jpeg: "JPEG" };

export type CertificateCheck = { ok: true; type: string } | { ok: false; error: Message };

export function checkCertificateFile(fileName: string, sizeBytes: number): CertificateCheck {
  const extension = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  const type = FSM_TYPES[extension];
  if (!type) return { ok: false, error: { key: "certificate.wrongType" } };
  if (sizeBytes === 0) return { ok: false, error: { key: "certificate.empty" } };
  if (sizeBytes > MAX_CERTIFICATE_BYTES) return { ok: false, error: { key: "certificate.tooLarge" } };
  return { ok: true, type };
}
