// Certificates = FSM Attachments on a Skill. Reads use the Query API (one JOIN returns the
// certificates of all our skills); files are uploaded, streamed and deleted through the Data API.
import { attachmentContentUrl, fsmCreate, fsmDelete, fsmQuery } from "@/lib/fsm/client";
import { CANDIDATE_ID_VALID, NAME_PREFIX } from "@/lib/candidate";
import { checkCertificateFile } from "@/lib/domain/certificate";
import type { FsmAttachment } from "@/lib/fsm/types";
import { UserError } from "@/lib/i18n/translate";
import { requireOwnAssignments } from "./assignments";
import { OwnershipError } from "./ownership";
import { dedupeById } from "./persons";
import type { Certificate } from "./model";

// Query rows are flat inside the alias, so nested fields arrive as "object.objectId".
export type AttachmentRow = {
  a: { id: string; fileName: string; type: string; createDateTime?: string; "object.objectId": string };
};

export interface CertificateUpload {
  fileName: string;
  sizeBytes: number;
  base64: string;
}

export function toCertificates(rows: AttachmentRow[]): Certificate[] {
  return dedupeById(rows.map((row) => row.a)).map((a) => ({
    id: a.id,
    assignmentId: a["object.objectId"],
    fileName: a.fileName,
    type: a.type,
    createdAt: a.createDateTime ?? null,
  }));
}

export async function listCertificates(): Promise<Certificate[]> {
  // The prefix goes into the query text, so it must be a validated candidate id.
  if (!CANDIDATE_ID_VALID) throw new OwnershipError({ key: "error.candidateId" });
  const sql = `
    SELECT a.id, a.fileName, a.type, a.createDateTime, a.object.objectId
    FROM Attachment a
    JOIN Skill s ON s.id = a.object.objectId
    JOIN Tag t ON t.id = s.tag
    WHERE a.object.objectType = 'SKILL' AND t.name LIKE '${NAME_PREFIX}%'
    ORDER BY a.createDateTime DESC`;
  return toCertificates(await fsmQuery<AttachmentRow>(sql, ["Attachment", "Skill", "Tag"]));
}

export interface UploadFailure {
  index: number; // position in the list of files that was passed in
  fileName: string;
  error: unknown; // the UI turns it into a text with toUserMessage()
}

// Uploads the files one by one and reports each file that failed, so one bad file does not
// stop the others.
export async function uploadCertificates(skillId: string, assignmentId: string, files: CertificateUpload[]): Promise<UploadFailure[]> {
  if (files.length === 0) return [];
  await requireOwnAssignments(skillId, [assignmentId]);
  return uploadToChecked(assignmentId, files);
}

// For an assignment that this save has just created or checked, so it is not read again.
export async function uploadToChecked(assignmentId: string, files: CertificateUpload[]): Promise<UploadFailure[]> {
  const failures: UploadFailure[] = [];
  for (const [index, file] of files.entries()) {
    const check = checkCertificateFile(file.fileName, file.sizeBytes);
    if (!check.ok) {
      failures.push({ index, fileName: file.fileName, error: new UserError(check.error) });
      continue;
    }
    try {
      await fsmCreate<FsmAttachment>("Attachment", {
        fileName: file.fileName,
        title: file.fileName,
        type: check.type,
        fileContent: file.base64,
        object: { objectId: assignmentId, objectType: "SKILL" },
      });
    } catch (error) {
      failures.push({ index, fileName: file.fileName, error });
    }
  }
  return failures;
}

// Only ids that FSM lists on one of our skills are deleted. Any other id is skipped: it was
// deleted in the meantime or it is not ours.
export async function deleteCertificates(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const own = new Set((await listCertificates()).map((certificate) => certificate.id));
  for (const id of ids.filter((id) => own.has(id))) await fsmDelete("Attachment", id);
}

export async function deleteCertificatesOf(assignmentIds: string[]): Promise<void> {
  const certificates = (await listCertificates()).filter((certificate) => assignmentIds.includes(certificate.assignmentId));
  for (const certificate of certificates) await fsmDelete("Attachment", certificate.id);
}

export function certificateUrl(certificate: Certificate): string {
  return attachmentContentUrl(certificate.id);
}
