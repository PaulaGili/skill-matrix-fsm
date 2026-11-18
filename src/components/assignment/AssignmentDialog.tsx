"use client";

import { useState } from "react";
import { Bar, Button, Dialog, MessageStrip, Text } from "@ui5/webcomponents-react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { isAiEnabled, readCertificateFacts } from "@/lib/ai/client";
import { checkFacts, type Suggestion } from "@/lib/domain/certificate-facts";
import { formatDate, todayIso } from "@/lib/domain/status";
import { fileToBase64 } from "@/lib/fsm/client";
import { toUserMessage } from "@/lib/fsm/errors";
import type { Assignment, Certificate, Person, Skill } from "@/lib/fsm/services/model";
import { removeAssignments } from "@/lib/fsm/services/remove";
import { saveAssignment } from "@/lib/fsm/services/save-assignment";
import { AssignmentFields, fieldsError, toInput } from "./AssignmentFields";
import { CertificateSection } from "./CertificateSection";
import styles from "./AssignmentDialog.module.css";

interface Props {
  person: Person;
  skill: Skill;
  assignment: Assignment | undefined; // undefined = not assigned yet
  certificates: Certificate[];
  onClose: () => void;
  onSaved: (message: string) => void;
  onChanged: () => void;
}

export function AssignmentDialog({ person, skill, assignment, certificates, onClose, onSaved, onChanged }: Props) {
  const [fields, setFields] = useState({ levelId: assignment?.levelId ?? null, startDate: assignment?.startDate ?? "", endDate: assignment?.endDate ?? "" });
  // What this dialog last read or wrote. A later save is checked against it, not against a
  // reload that happened while the dialog was open.
  const [saved, setSaved] = useState(assignment);
  const [marked, setRemovedIds] = useState<string[]>([]);
  // A certificate that someone else deleted in the meantime is no longer marked.
  const removedIds = marked.filter((id) => certificates.some((certificate) => certificate.id === id));
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const aiEnabled = useAsyncData(isAiEnabled).data === true;
  const [suggestion, setSuggestion] = useState<(Suggestion & { fileName: string }) | null>(null);
  const [busy, setBusy] = useState(false);

  const dateError = fieldsError(fields);

  async function save() {
    if (dateError) return;
    setBusy(true);
    setMessages([]);
    try {
      const uploads = await Promise.all(newFiles.map(async (file) => ({ fileName: file.name, sizeBytes: file.size, base64: await fileToBase64(file) })));
      const { saved: nowSaved, failures } = await saveAssignment(skill.id, person.id, saved, {
        input: toInput(fields),
        deleteCertificateIds: removedIds,
        uploads,
      });
      if (failures.length === 0) return onSaved(saved ? "Assignment saved." : "Skill assigned.");

      // The assignment is saved, but some files were not uploaded. Keep those in the list.
      setSaved(nowSaved);
      setMessages(failures.map((failure) => failure.message));
      setRemovedIds([]);
      setNewFiles(newFiles.filter((_, index) => failures.some((failure) => failure.index === index)));
    } catch (error) {
      setMessages([toUserMessage(error)]);
    }
    setBusy(false);
    onChanged();
  }

  // The AI only proposes. The dates go into the form when the user accepts them, and
  // nothing is saved before Save.
  async function readWithAi(file: File) {
    setBusy(true);
    setMessages([]);
    setSuggestion(null);
    try {
      setSuggestion({ fileName: file.name, ...checkFacts(await readCertificateFacts(file), person.displayName, todayIso()) });
    } catch (error) {
      setMessages([toUserMessage(error)]);
    }
    setBusy(false);
  }

  function applySuggestion() {
    setFields({ ...fields, startDate: suggestion?.validFrom ?? fields.startDate, endDate: suggestion?.validTo ?? fields.endDate });
    setSuggestion(null);
  }

  async function remove() {
    setBusy(true);
    try {
      await removeAssignments(skill.id, [saved!.id]);
      onSaved("Assignment removed.");
    } catch (error) {
      setMessages([toUserMessage(error)]);
      setBusy(false);
      onChanged();
    }
  }

  return (
    <Dialog
      open
      headerText={`${skill.name}: ${person.displayName}`}
      onBeforeClose={(event) => busy && event.preventDefault()}
      onClose={onClose}
      footer={
        <Bar
          design="Footer"
          startContent={
            saved &&
            (confirmingRemove ? (
              <Button design="Negative" disabled={busy} onClick={remove}>
                Remove now
              </Button>
            ) : (
              <Button design="Negative" disabled={busy} onClick={() => setConfirmingRemove(true)}>
                Remove assignment...
              </Button>
            ))
          }
          endContent={
            <>
              {!confirmingRemove && (
                <Button design="Emphasized" disabled={busy || dateError !== null} onClick={save}>
                  {saved ? "Save" : "Assign"}
                </Button>
              )}
              <Button design="Transparent" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
            </>
          }
        />
      }
    >
      <div className={styles.form}>
        {messages.map((message) => (
          <MessageStrip key={message} design="Negative" hideCloseButton>
            {message}
          </MessageStrip>
        ))}
        {suggestion && (
          <MessageStrip design={suggestion.notes.length > 0 ? "Critical" : "Information"} onClose={() => setSuggestion(null)}>
            <div className={styles.suggestion}>
              <Text>
                Read from {suggestion.fileName} by AI.{" "}
                {(suggestion.validFrom || suggestion.validTo) &&
                  `Valid from ${suggestion.validFrom ? formatDate(suggestion.validFrom) : "not found"}, valid to ${suggestion.validTo ? formatDate(suggestion.validTo) : "not found"}. `}
                {suggestion.notes.join(" ")}
              </Text>
              {(suggestion.validFrom || suggestion.validTo) && <Button onClick={applySuggestion}>Use these dates</Button>}
            </div>
          </MessageStrip>
        )}
        {confirmingRemove && (
          <MessageStrip design="Critical" hideCloseButton>
            This removes the assignment
            {certificates.length > 0 ? ` and its ${certificates.length === 1 ? "certificate" : `${certificates.length} certificates`}` : ""}. It cannot be
            undone.
          </MessageStrip>
        )}

        <AssignmentFields scaleId={skill.scaleId} value={fields} disabled={busy} onChange={setFields} />

        <CertificateSection
          certificates={certificates}
          removedIds={removedIds}
          newFiles={newFiles}
          disabled={busy}
          onToggleRemoved={(id) => setRemovedIds((ids) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]))}
          onNewFiles={setNewFiles}
          onRejected={setMessages}
          onRead={aiEnabled ? readWithAi : undefined}
        />
      </div>
    </Dialog>
  );
}
