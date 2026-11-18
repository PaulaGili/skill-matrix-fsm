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
import { useI18n } from "@/lib/i18n/I18nProvider";
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
  const { t } = useI18n();

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
      if (failures.length === 0) return onSaved(t(saved ? "assignment.saved" : "assignment.assigned"));

      // The assignment is saved, but some files were not uploaded. Keep those in the list.
      setSaved(nowSaved);
      setMessages(failures.map((failure) => `${failure.fileName}: ${toUserMessage(failure.error, t)}`));
      setRemovedIds([]);
      setNewFiles(newFiles.filter((_, index) => failures.some((failure) => failure.index === index)));
    } catch (error) {
      setMessages([toUserMessage(error, t)]);
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
      setMessages([toUserMessage(error, t)]);
    }
    setBusy(false);
  }

  // What the AI read, as one text: the file, the dates if any, then the notes.
  function suggestionText({ fileName, validFrom, validTo, notes }: Suggestion & { fileName: string }): string {
    const date = (value: string | null) => (value ? formatDate(value) : t("assignment.notFound"));
    const dates = validFrom || validTo ? [t("assignment.readDates", { from: date(validFrom), to: date(validTo) })] : [];
    return [t("assignment.readByAi", { file: fileName }), ...dates, ...notes.map((note) => t(note.key, note.params))].join(" ");
  }

  function applySuggestion() {
    setFields({ ...fields, startDate: suggestion?.validFrom ?? fields.startDate, endDate: suggestion?.validTo ?? fields.endDate });
    setSuggestion(null);
  }

  async function remove() {
    setBusy(true);
    try {
      await removeAssignments(skill.id, [saved!.id]);
      onSaved(t("assignment.removed"));
    } catch (error) {
      setMessages([toUserMessage(error, t)]);
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
                {t("assignment.removeNow")}
              </Button>
            ) : (
              <Button design="Negative" disabled={busy} onClick={() => setConfirmingRemove(true)}>
                {t("assignment.remove")}
              </Button>
            ))
          }
          endContent={
            <>
              {!confirmingRemove && (
                <Button design="Emphasized" disabled={busy || dateError !== null} onClick={save}>
                  {t(saved ? "action.save" : "action.assign")}
                </Button>
              )}
              <Button design="Transparent" disabled={busy} onClick={onClose}>
                {t("action.cancel")}
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
              <Text>{suggestionText(suggestion)}</Text>
              {(suggestion.validFrom || suggestion.validTo) && <Button onClick={applySuggestion}>{t("assignment.useDates")}</Button>}
            </div>
          </MessageStrip>
        )}
        {confirmingRemove && (
          <MessageStrip design="Critical" hideCloseButton>
            {certificates.length > 0 ? t("assignment.removeWarningCertificates", { count: certificates.length }) : t("assignment.removeWarning")}
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
