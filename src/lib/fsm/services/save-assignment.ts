// Saves everything the assignment dialog collects, in this order: the assignment itself,
// certificates marked for deletion, then new certificates.
import { createAssignment, updateAssignment, type AssignmentInput } from "./assignments";
import { todayIso } from "@/lib/domain/status";
import { deleteCertificates, uploadCertificates, type CertificateUpload, type UploadFailure } from "./certificates";
import type { Assignment } from "./model";

export interface AssignmentChanges {
  input: AssignmentInput;
  deleteCertificateIds: string[];
  uploads: CertificateUpload[];
}

function inputChanged(loaded: Assignment, input: AssignmentInput): boolean {
  return loaded.levelId !== input.levelId || loaded.startDate !== (input.startDate || null) || loaded.endDate !== (input.endDate || null);
}

export interface SaveResult {
  saved: Assignment; // the assignment as it is now, the base for the next save
  failures: UploadFailure[];
}

// `loaded` is undefined for a new assignment.
export async function saveAssignment(skillId: string, personId: string, loaded: Assignment | undefined, changes: AssignmentChanges): Promise<SaveResult> {
  let saved = loaded;
  if (!saved) {
    saved = await createAssignment(skillId, personId, changes.input);
  } else if (inputChanged(saved, changes.input)) {
    await updateAssignment(skillId, saved, changes.input);
    saved = { ...saved, levelId: changes.input.levelId, startDate: changes.input.startDate || todayIso(), endDate: changes.input.endDate || null };
  }
  await deleteCertificates(changes.deleteCertificateIds);
  return { saved, failures: await uploadCertificates(skillId, saved.id, changes.uploads) };
}
