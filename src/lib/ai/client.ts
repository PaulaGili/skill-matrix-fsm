// Browser side of the AI features. The key never leaves the server.
import { existingSkill, type CertificateFacts } from "@/lib/domain/certificate-facts";
import type { QuestionAnswer } from "@/lib/domain/question";
import { fileToBase64 } from "@/lib/fsm/client";
import { UserError, type MessageKey } from "@/lib/i18n/translate";

export async function isAiEnabled(): Promise<boolean> {
  const response = await fetch("/api/ai/certificate");
  return response.ok && (await response.json()).enabled === true;
}

// The routes answer with an English text. The status is enough to show a translated one.
async function post<T>(path: string, body: unknown, fallback: MessageKey): Promise<T> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  if (response.status === 429) throw new UserError({ key: "ai.busy" });
  if (response.status === 502 || response.status === 503) throw new UserError({ key: "ai.unavailable" });
  if (!response.ok || !data) throw new UserError({ key: fallback });
  return data;
}

// The skill name is sent with the file, so the AI can say whether the certificate is for it.
export async function readCertificateFacts(file: File, skill?: string): Promise<CertificateFacts> {
  return post("/api/ai/certificate", { fileName: file.name, base64: await fileToBase64(file), skill }, "ai.certificateNotRead");
}

// Asks whether a new skill name means the same as an existing one. Only skill names are sent.
export async function findSimilarSkill(name: string, existing: string[]): Promise<string | null> {
  const answer = await post<{ similar: string | null }>("/api/ai/similar-skill", { name, existing }, "ai.nameNotChecked");
  return existingSkill(answer.similar, existing);
}

// Sends the question with the names of skills and levels. No person data leaves the browser.
export function askMatrix(question: string, skills: string[], levels: string[]): Promise<QuestionAnswer> {
  return post("/api/ai/question", { question, skills, levels }, "ai.questionFailed");
}
