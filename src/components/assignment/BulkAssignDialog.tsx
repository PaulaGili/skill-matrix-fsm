"use client";

import { useState } from "react";
import { Bar, Button, Dialog, Label, MessageStrip, MultiComboBox, MultiComboBoxItem, Option, Select, Switch, Title } from "@ui5/webcomponents-react";
import { toUserMessage } from "@/lib/fsm/errors";
import { MAX_BULK_ASSIGNMENTS, createAssignments } from "@/lib/fsm/services/assignments";
import type { Person, Skill } from "@/lib/fsm/services/model";
import { LevelField, ValidityFields, fieldsError, toInput, type FieldValues } from "./AssignmentFields";
import styles from "./AssignmentDialog.module.css";

interface Props {
  skills: Skill[];
  persons: Person[];
  isAssigned: (personId: string, skillId: string) => boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  onChanged: () => void; // something may have been written, reload the matrix
}

// Assigns one skill to several persons with the same level. The validity is the same for
// everyone or set per person.
export function BulkAssignDialog({ skills, persons, isAssigned, onClose, onSaved, onChanged }: Props) {
  const [skillId, setSkillId] = useState(skills[0].id);
  const [pickedIds, setPersonIds] = useState<string[]>([]);
  const [fields, setFields] = useState<FieldValues>({ levelId: null, startDate: "", endDate: "" });
  const [sameDates, setSameDates] = useState(true);
  const [ownDates, setOwnDates] = useState<Record<string, FieldValues>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const skill = skills.find((s) => s.id === skillId)!;
  const candidates = persons.filter((person) => !isAssigned(person.id, skillId));
  // After a failed attempt the matrix reloads: who got the skill by then is no longer selected.
  const personIds = pickedIds.filter((id) => candidates.some((person) => person.id === id));
  const tooMany = personIds.length > MAX_BULK_ASSIGNMENTS;
  // The values to save for one person: the shared ones, or that person's own dates.
  const valuesOf = (personId: string): FieldValues => (sameDates ? fields : { ...(ownDates[personId] ?? fields), levelId: fields.levelId });
  const invalid = personIds.some((personId) => fieldsError(valuesOf(personId)) !== null);

  async function assign() {
    setBusy(true);
    setError(null);
    try {
      await createAssignments(
        skillId,
        personIds.map((personId) => ({ ...toInput(valuesOf(personId)), personId })),
      );
      onSaved(`${skill.name} assigned to ${personIds.length} ${personIds.length === 1 ? "person" : "persons"}.`);
    } catch (e) {
      setError(toUserMessage(e));
      setBusy(false);
      onChanged();
    }
  }

  return (
    <Dialog
      open
      headerText="Assign a skill to several persons"
      onBeforeClose={(event) => busy && event.preventDefault()}
      onClose={onClose}
      footer={
        <Bar
          design="Footer"
          endContent={
            <>
              <Button design="Emphasized" disabled={busy || personIds.length === 0 || tooMany || invalid} onClick={assign}>
                Assign to {personIds.length} {personIds.length === 1 ? "person" : "persons"}
              </Button>
              <Button design="Transparent" disabled={busy} onClick={onClose}>
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
        {tooMany && (
          <MessageStrip design="Critical" hideCloseButton>
            Select at most {MAX_BULK_ASSIGNMENTS} persons at once.
          </MessageStrip>
        )}

        <Label for="bulk-skill">Skill</Label>
        <Select
          id="bulk-skill"
          disabled={busy}
          onChange={(event) => {
            setSkillId(event.detail.selectedOption.dataset.id ?? skillId);
            setPersonIds([]);
            setFields({ ...fields, levelId: null });
          }}
        >
          {skills.map((s) => (
            <Option key={s.id} data-id={s.id} selected={s.id === skillId}>
              {s.name}
            </Option>
          ))}
        </Select>

        <Label for="bulk-persons">Persons without this skill ({candidates.length})</Label>
        <MultiComboBox
          key={skillId}
          id="bulk-persons"
          placeholder="Select persons"
          showSelectAll
          disabled={busy}
          onSelectionChange={(event) => setPersonIds(event.detail.items.map((item) => item.dataset.id ?? ""))}
        >
          {candidates.map((person) => (
            <MultiComboBoxItem key={person.id} text={person.displayName} data-id={person.id} selected={personIds.includes(person.id)} />
          ))}
        </MultiComboBox>

        <LevelField key={skill.scaleId} scaleId={skill.scaleId} value={fields} disabled={busy} onChange={setFields} />

        <span className={styles.inline}>
          <Switch
            id="same-dates"
            accessibleNameRef="same-dates-label"
            checked={sameDates}
            disabled={busy}
            onChange={(event) => setSameDates(event.target.checked)}
          />
          <Label id="same-dates-label" for="same-dates" onClick={() => busy || setSameDates(!sameDates)}>
            Same validity for everyone
          </Label>
        </span>
        {sameDates ? (
          <ValidityFields value={fields} disabled={busy} onChange={setFields} />
        ) : (
          persons
            .filter((person) => personIds.includes(person.id))
            .map((person) => (
              <div key={person.id} className={styles.personDates}>
                <Title level="H6">{person.displayName}</Title>
                <ValidityFields
                  idPrefix={`valid-${person.id}`}
                  value={valuesOf(person.id)}
                  disabled={busy}
                  onChange={(value) => setOwnDates({ ...ownDates, [person.id]: value })}
                />
              </div>
            ))
        )}
      </div>
    </Dialog>
  );
}
