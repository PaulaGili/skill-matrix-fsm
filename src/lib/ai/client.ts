// Browser side of the AI feature. The key never leaves the server.
import type { CertificateFacts } from "@/lib/domain/certificate-facts";
import { fileToBase64 } from "@/lib/fsm/client";

export async function isAiEnabled(): Promise<boolean> {
  const response = await fetch("/api/ai/certificate");
  return response.ok && (await response.json()).enabled === true;
}

export async function readCertificateFacts(file: File): Promise<CertificateFacts> {
  const response = await fetch("/api/ai/certificate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, base64: await fileToBase64(file) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error ?? "The certificate could not be read.");
  return data;
}
