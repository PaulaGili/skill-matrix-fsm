"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, Button, Dialog, Input, Label, MessageStrip, Text, type InputDomRef } from "@ui5/webcomponents-react";
import { splitForRetire } from "@/lib/domain/retire";
import { todayIso } from "@/lib/domain/status";
import { toUserMessage } from "@/lib/fsm/errors";
import type { Assignment, Certificate, Skill } from "@/lib/fsm/services/model";
import { deleteSkillWithAssignments, retireSkill } from "@/lib/fsm/services/remove";
import { deleteSkill } from "@/lib/fsm/services/skills";
import styles from "./SkillDialog.module.css";

interface Props {
  skill: Skill;
  assignments: Assignment[];
  certificates: Certificate[];
  onClose: () => void;
  onDone: (message: string) => void;
  onFailed: () => void; // the data may have changed, reload it
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// A skill without assignments is deleted after a simple confirmation. A skill that is still
// assigned can be retired or deleted together with everything attached to it.
export function RemoveSkillDialog({ skill, assignments, certificates, onClose, onDone, onFailed }: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmInput = useRef<InputDomRef>(null);

  useEffect(() => {
    if (confirmingDelete) confirmInput.current?.focus();
  }, [confirmingDelete]);

  const assigned = assignments.length > 0;
  const { toEnd, toRemove } = splitForRetire(assignments, todayIso());

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone(message);
    } catch (error) {
      setError(toUserMessage(error));
      setBusy(false);
      onFailed();
    }
  }

  return (
    <Dialog
      open
      state={assigned ? "Critical" : "None"}
      headerText={assigned ? `Remove ${skill.name}?` : `Delete ${skill.name}?`}
      initialFocus="remove-skill-cancel"
      onBeforeClose={(event) => busy && event.preventDefault()}
      onClose={onClose}
      footer={
        <Bar
          design="Footer"
          startContent={
            assigned &&
            (confirmingDelete ? (
              <Button
                design="Negative"
                disabled={busy || confirmName.trim() !== skill.name}
                onClick={() => run(() => deleteSkillWithAssignments(skill.id), `${skill.name} deleted.`)}
              >
                Delete everything
              </Button>
            ) : (
              <Button design="Negative" disabled={busy} onClick={() => setConfirmingDelete(true)}>
                Delete everything...
              </Button>
            ))
          }
          endContent={
            <>
              {toEnd.length > 0 && !confirmingDelete && (
                <Button design="Emphasized" disabled={busy} onClick={() => run(() => retireSkill(skill.id), `${skill.name} retired.`)}>
                  Retire skill
                </Button>
              )}
              {!assigned && (
                <Button design="Negative" disabled={busy} onClick={() => run(() => deleteSkill(skill.id), `${skill.name} deleted.`)}>
                  Delete
                </Button>
              )}
              <Button id="remove-skill-cancel" design="Transparent" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
            </>
          }
        />
      }
    >
      <div className={styles.form}>
        {error && (
          <MessageStrip design="Negative" hideCloseButton>
            {error}
          </MessageStrip>
        )}
        {!assigned && <Text>This skill is not assigned to anyone.</Text>}
        {assigned && (
          <Text>
            {skill.name} has {plural(assignments.length, "assignment")} and {plural(certificates.length, "certificate")}.
          </Text>
        )}
        {toEnd.length > 0 && (
          <Text>
            <b>Retire skill</b> ends the {plural(toEnd.length, "valid assignment")} as of yesterday, so {toEnd.length === 1 ? "it shows" : "they show"} as
            expired. The history and certificates are kept.
            {toRemove.length > 0 && ` ${plural(toRemove.length, "assignment")} starting today or later ${toRemove.length === 1 ? "is" : "are"} removed.`}
          </Text>
        )}
        {assigned && (
          <Text>
            <b>Delete everything</b> permanently removes the skill, all its assignments and their certificates.
          </Text>
        )}
        {confirmingDelete && (
          <>
            <Label for="confirm-name">Type the skill name to confirm</Label>
            <Input id="confirm-name" ref={confirmInput} value={confirmName} placeholder={skill.name} onInput={(event) => setConfirmName(event.target.value)} />
          </>
        )}
      </div>
    </Dialog>
  );
}
