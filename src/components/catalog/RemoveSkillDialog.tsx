"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, Button, Dialog, Input, Label, MessageStrip, Text, type InputDomRef } from "@ui5/webcomponents-react";
import { splitForRetire } from "@/lib/domain/retire";
import { todayIso } from "@/lib/domain/status";
import { toUserMessage } from "@/lib/fsm/errors";
import type { Assignment, Certificate, Skill } from "@/lib/fsm/services/model";
import { deleteSkillWithAssignments, retireSkill } from "@/lib/fsm/services/remove";
import { deleteSkill } from "@/lib/fsm/services/skills";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./SkillDialog.module.css";

interface Props {
  skill: Skill;
  assignments: Assignment[];
  certificates: Certificate[];
  onClose: () => void;
  onDone: (message: string) => void;
  onFailed: () => void; // the data may have changed, reload it
}

// A skill without assignments is deleted after a simple confirmation. A skill that is still
// assigned can be retired or deleted together with everything attached to it.
export function RemoveSkillDialog({ skill, assignments, certificates, onClose, onDone, onFailed }: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmInput = useRef<InputDomRef>(null);
  const { t } = useI18n();
  const name = skill.name;

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
      setError(toUserMessage(error, t));
      setBusy(false);
      onFailed();
    }
  }

  return (
    <Dialog
      open
      state={assigned ? "Critical" : "None"}
      headerText={t(assigned ? "remove.titleAssigned" : "remove.titleUnassigned", { name })}
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
                onClick={() => run(() => deleteSkillWithAssignments(skill.id), t("remove.deleted", { name }))}
              >
                {t("remove.deleteEverything")}
              </Button>
            ) : (
              <Button design="Negative" disabled={busy} onClick={() => setConfirmingDelete(true)}>
                {t("remove.deleteEverythingAsk")}
              </Button>
            ))
          }
          endContent={
            <>
              {toEnd.length > 0 && !confirmingDelete && (
                <Button design="Emphasized" disabled={busy} onClick={() => run(() => retireSkill(skill.id), t("remove.retired", { name }))}>
                  {t("remove.retire")}
                </Button>
              )}
              {!assigned && (
                <Button design="Negative" disabled={busy} onClick={() => run(() => deleteSkill(skill.id), t("remove.deleted", { name }))}>
                  {t("action.delete")}
                </Button>
              )}
              <Button id="remove-skill-cancel" design="Transparent" disabled={busy} onClick={onClose}>
                {t("action.cancel")}
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
        {!assigned && <Text>{t("remove.notAssigned")}</Text>}
        {assigned && (
          <Text>
            {t("remove.has", {
              name,
              assignments: t("count.assignments", { count: assignments.length }),
              certificates: t("count.certificates", { count: certificates.length }),
            })}
          </Text>
        )}
        {toEnd.length > 0 && (
          <Text>
            <b>{t("remove.retire")}</b> {t("remove.retireText", { count: toEnd.length })}
            {toRemove.length > 0 && ` ${t("remove.futureRemoved", { count: toRemove.length })}`}
          </Text>
        )}
        {assigned && (
          <Text>
            <b>{t("remove.deleteEverything")}</b> {t("remove.deleteText")}
          </Text>
        )}
        {confirmingDelete && (
          <>
            <Label for="confirm-name">{t("remove.typeName")}</Label>
            <Input id="confirm-name" ref={confirmInput} value={confirmName} placeholder={skill.name} onInput={(event) => setConfirmName(event.target.value)} />
          </>
        )}
      </div>
    </Dialog>
  );
}
