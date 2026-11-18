"use client";

import { useState } from "react";
import { Bar, Button, Dialog, Input, Label, MessageStrip, TextArea } from "@ui5/webcomponents-react";
import { toUserMessage } from "@/lib/fsm/errors";
import type { Skill } from "@/lib/fsm/services/model";
import { ensureLevelScale } from "@/lib/fsm/services/scale";
import { createSkill, skillNameError, updateSkill } from "@/lib/fsm/services/skills";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./SkillDialog.module.css";

interface Props {
  skill: Skill | null; // null = create a new skill
  existingSkills: Skill[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function SkillDialog({ skill, existingSkills, onClose, onSaved }: Props) {
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { t } = useI18n();

  function validate(): string | null {
    const duplicate = existingSkills.some((other) => other.id !== skill?.id && other.name.toLowerCase() === name.trim().toLowerCase());
    const error = skillNameError(name) ?? (duplicate ? { key: "skill.duplicate" as const } : null);
    return error && t(error.key);
  }

  async function save() {
    if (saving) return; // Enter pressed twice
    const error = validate();
    setNameError(error);
    if (error) return;

    setSaving(true);
    setSaveError(null);
    try {
      if (skill) {
        await updateSkill(skill.id, { name, description });
      } else {
        const scale = await ensureLevelScale();
        await createSkill({ name, description, scaleId: scale.id });
      }
      onSaved(t(skill ? "skill.saved" : "skill.created"));
    } catch (error) {
      setSaveError(toUserMessage(error, t));
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      headerText={t(skill ? "skill.editTitle" : "catalog.create")}
      onBeforeClose={(event) => saving && event.preventDefault()}
      onClose={onClose}
      footer={
        <Bar
          design="Footer"
          endContent={
            <>
              <Button design="Emphasized" onClick={save} disabled={saving}>
                {t(skill ? "action.save" : "action.create")}
              </Button>
              <Button design="Transparent" onClick={onClose} disabled={saving}>
                {t("action.cancel")}
              </Button>
            </>
          }
        />
      }
    >
      <div className={styles.form}>
        {saveError && (
          <MessageStrip design="Negative" hideCloseButton>
            {saveError}
          </MessageStrip>
        )}
        <Label for="skill-name" required>
          {t("field.name")}
        </Label>
        <Input
          id="skill-name"
          value={name}
          maxlength={200}
          valueState={nameError ? "Negative" : "None"}
          valueStateMessage={nameError ? <span>{nameError}</span> : undefined}
          required
          onInput={(event) => {
            setName(event.target.value);
            setNameError(null);
          }}
          onKeyDown={(event) => event.key === "Enter" && save()}
        />
        <Label for="skill-description">{t("field.description")}</Label>
        <TextArea id="skill-description" value={description} rows={3} maxlength={500} onInput={(event) => setDescription(event.target.value)} />
      </div>
    </Dialog>
  );
}
