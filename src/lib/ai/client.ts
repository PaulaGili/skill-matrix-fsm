// Browser side of the AI features. The key never leaves the server.
import { existingSkill, type CertificateFacts } from "@/lib/domain/certificate-facts";
import { columnsFromHeaders, type ColumnMap, type ImportField } from "@/lib/domain/import";
import type { QuestionAnswer } from "@/lib/domain/question";
import { fileToBase64 } from "@/lib/fsm/client";
import { UserError, type MessageKey } from "@/lib/i18n/translate";

// Asked once and remembered: the answer cannot change while the page is open. A request that
// failed is not remembered, so the next dialog asks again.
let enabled: Promise<boolean> | undefined;
export function isAiEnabled(): Promise<boolean> {
  enabled ??= fetch("/api/ai")
    .then(async (response) => (await response.json()).enabled === true)
    .catch(() => {
      enabled = undefined;
      return false;
    });
  return enabled;
}

// The status of the answer is enough to show a translated text.
async function post<T>(path: string, body: unknown, fallback: MessageKey): Promise<T> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  if (response.status === 413) throw new UserError({ key: "error.tooLargeForServer" });
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

// Sends the question with the names of skills and levels. A name typed in the question goes with it.
export function askMatrix(question: string, skills: string[], levels: string[]): Promise<QuestionAnswer> {
  return post("/api/ai/question", { question, skills, levels }, "ai.questionFailed");
}

// Asks which column of an import file holds which field. Only the titles given here are sent.
export async function matchImportColumns(headers: string[]): Promise<ColumnMap> {
  const answer = await post<Record<ImportField, string | null>>("/api/ai/import-columns", { headers }, "ai.columnsNotMatched");
  return columnsFromHeaders(answer, headers);
}
