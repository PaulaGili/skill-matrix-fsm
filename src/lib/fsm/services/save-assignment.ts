// Saves everything the assignment dialog collects, in this order: the assignment itself,
// certificates marked for deletion, then new certificates.
import { createAssignment, updateAssignment, type AssignmentInput } from "./assignments";
import { deleteCertificates, uploadCertificates, type CertificateUpload } from "./certificates";
import type { Assignment } from "./model";

export interface AssignmentChanges {
  input: AssignmentInput;
  deleteCertificateIds: string[];
  uploads: CertificateUpload[];
}

function inputChanged(loaded: Assignment, input: AssignmentInput): boolean {
  return loaded.levelId !== input.levelId || loaded.startDate !== (input.startDate || null) || loaded.endDate !== (input.endDate || null);
}

// `loaded` is undefined for a new assignment. Returns one message per upload that failed.
export async function saveAssignment(skillId: string, personId: string, loaded: Assignment | undefined, changes: AssignmentChanges): Promise<string[]> {
  let assignmentId = loaded?.id;
  if (!loaded) {
    assignmentId = (await createAssignment(skillId, personId, changes.input)).id;
  } else if (inputChanged(loaded, changes.input)) {
    await updateAssignment(skillId, loaded, changes.input);
  }
  await deleteCertificates(changes.deleteCertificateIds);
  return uploadCertificates(skillId, assignmentId!, changes.uploads);
}
