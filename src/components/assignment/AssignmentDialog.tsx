"use client";

import { useCallback, useState } from "react";
import { Bar, Button, DatePicker, Dialog, Label, MessageStrip, Option, Select, Text } from "@ui5/webcomponents-react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { validateValidity } from "@/lib/domain/status";
import { fileToBase64 } from "@/lib/fsm/client";
import { toUserMessage } from "@/lib/fsm/errors";
import type { Assignment, Certificate, Person, Skill } from "@/lib/fsm/services/model";
import { removeAssignments } from "@/lib/fsm/services/remove";
import { saveAssignment } from "@/lib/fsm/services/save-assignment";
import { listLevels } from "@/lib/fsm/services/scale";
import { CertificateSection } from "./CertificateSection";
import styles from "./AssignmentDialog.module.css";

interface Props {
  person: Person;
  skill: Skill;
  assignment: Assignment | undefined; // undefined = not assigned yet
  certificates: Certificate[];
  reloading: boolean; // the matrix is loading, so `assignment` may be out of date
  onClose: () => void;
  onSaved: (message: string) => void;
  onChanged: () => void;
}

export function AssignmentDialog({ person, skill, assignment, certificates, reloading, onClose, onSaved, onChanged }: Props) {
  const loadLevels = useCallback(() => (skill.scaleId ? listLevels(skill.scaleId) : Promise.resolve([])), [skill.scaleId]);
  const levels = useAsyncData(loadLevels);

  const [levelId, setLevelId] = useState(assignment?.levelId ?? null);
  const [startDate, setStartDate] = useState(assignment?.startDate ?? "");
  const [endDate, setEndDate] = useState(assignment?.endDate ?? "");
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [busy, setBusy] = useState(false);

  const dateError = validateValidity(startDate || null, endDate || null);
  const startError = dateError?.startsWith("Valid from") ? dateError : null;
  const endError = startError ? null : dateError;

  async function save() {
    if (dateError) return;
    setBusy(true);
    setMessages([]);
    try {
      const uploads = await Promise.all(newFiles.map(async (file) => ({ fileName: file.name, sizeBytes: file.size, base64: await fileToBase64(file) })));
      const failures = await saveAssignment(skill.id, person.id, assignment, {
        input: { levelId, startDate: startDate || null, endDate: endDate || null },
        deleteCertificateIds: removedIds,
        uploads,
      });
      if (failures.length === 0) return onSaved(assignment ? "Assignment saved." : "Skill assigned.");

      // The assignment is saved, but some files were not uploaded. Keep those in the list.
      setMessages(failures);
      setRemovedIds([]);
      setNewFiles(newFiles.filter((file) => failures.some((failure) => failure.startsWith(file.name))));
    } catch (error) {
      setMessages([toUserMessage(error)]);
    }
    setBusy(false);
    onChanged();
  }

  async function remove() {
    setBusy(true);
    try {
      await removeAssignments(skill.id, [assignment!.id]);
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
            assignment &&
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
                <Button design="Emphasized" disabled={busy || reloading || dateError !== null || levels.loading} onClick={save}>
                  {assignment ? "Save" : "Assign"}
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
        {[...(levels.error ? [levels.error] : []), ...messages].map((message) => (
          <MessageStrip key={message} design="Negative" hideCloseButton>
            {message}
          </MessageStrip>
        ))}
        {confirmingRemove && (
          <MessageStrip design="Critical" hideCloseButton>
            This removes the assignment
            {certificates.length > 0 ? ` and its ${certificates.length === 1 ? "certificate" : `${certificates.length} certificates`}` : ""}. It cannot be
            undone.
          </MessageStrip>
        )}

        <Label for="assignment-level">Level</Label>
        <Select id="assignment-level" disabled={busy || levels.loading} onChange={(event) => setLevelId(event.detail.selectedOption.dataset.id || null)}>
          <Option data-id="" selected={levelId === null}>
            No level
          </Option>
          {(levels.data ?? []).map((level) => (
            <Option key={level.id} data-id={level.id} selected={level.id === levelId}>
              {level.name}
            </Option>
          ))}
        </Select>

        <div className={styles.dates}>
          <div>
            <Label for="valid-from">Valid from</Label>
            <DatePicker
              id="valid-from"
              value={startDate}
              valueFormat="yyyy-MM-dd"
              displayFormat="dd.MM.yyyy"
              placeholder="Today if empty"
              showClearIcon
              disabled={busy}
              valueState={startError ? "Negative" : "None"}
              valueStateMessage={startError ? <span>{startError}</span> : undefined}
              onChange={(event) => setStartDate(event.detail.value)}
            />
          </div>
          <div>
            <Label for="valid-to">Valid to</Label>
            <DatePicker
              id="valid-to"
              value={endDate}
              valueFormat="yyyy-MM-dd"
              displayFormat="dd.MM.yyyy"
              placeholder="No end date"
              showClearIcon
              disabled={busy}
              valueState={endError ? "Negative" : "None"}
              valueStateMessage={endError ? <span>{endError}</span> : undefined}
              onChange={(event) => setEndDate(event.detail.value)}
            />
          </div>
        </div>
        {dateError && (
          <Text className={styles.error} role="alert">
            {dateError}
          </Text>
        )}

        <CertificateSection
          certificates={certificates}
          removedIds={removedIds}
          newFiles={newFiles}
          disabled={busy}
          onToggleRemoved={(id) => setRemovedIds((ids) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]))}
          onNewFiles={setNewFiles}
          onRejected={setMessages}
        />
      </div>
    </Dialog>
  );
}
