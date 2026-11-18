// Saves everything the assignment dialog collects, in this order: the assignment itself,
// certificates marked for deletion, then new certificates.
import { createAssignment, updateAssignment, type AssignmentInput } from "./assignments";
import { todayIso } from "@/lib/domain/status";
import { deleteCertificates, uploadCertificates, uploadToChecked, type CertificateUpload, type UploadFailure } from "./certificates";
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
  notDeleted: unknown; // the error when the marked certificates could not be deleted, else null
}

// `loaded` is undefined for a new assignment.
export async function saveAssignment(skillId: string, personId: string, loaded: Assignment | undefined, changes: AssignmentChanges): Promise<SaveResult> {
  // The assignment first. Creating and updating read it back from FSM and check that it is
  // ours and that nobody changed it. If that is refused, no certificate has been touched.
  let saved = loaded;
  let checked = false;
  if (!saved) {
    saved = await createAssignment(skillId, personId, changes.input);
    checked = true;
  } else if (inputChanged(saved, changes.input)) {
    await updateAssignment(skillId, saved, changes.input);
    saved = { ...saved, levelId: changes.input.levelId, startDate: changes.input.startDate || todayIso(), endDate: changes.input.endDate || null };
    checked = true;
  }
  // The certificates after it. What fails here is reported next to the saved assignment, so
  // the dialog shows what FSM holds now and Save can be pressed again.
  let notDeleted: unknown = null;
  try {
    await deleteCertificates(changes.deleteCertificateIds);
  } catch (error) {
    notDeleted = error;
  }
  // The upload does not check an assignment again that this save has just created or checked.
  const failures = checked ? await uploadToChecked(saved.id, changes.uploads) : await uploadCertificates(skillId, saved.id, changes.uploads);
  return { saved, failures, notDeleted };
}
