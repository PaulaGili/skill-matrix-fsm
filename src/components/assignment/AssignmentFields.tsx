"use client";

import { useCallback } from "react";
import { DatePicker, Label, MessageStrip, Option, Select, Text } from "@ui5/webcomponents-react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { validateValidity } from "@/lib/domain/status";
import type { AssignmentInput } from "@/lib/fsm/services/assignments";
import { listLevels } from "@/lib/fsm/services/scale";
import styles from "./AssignmentDialog.module.css";

// The form keeps empty dates as "", which is what the date picker works with.
export interface FieldValues {
  levelId: string | null;
  startDate: string;
  endDate: string;
}

export function fieldsError(value: FieldValues): string | null {
  return validateValidity(value.startDate || null, value.endDate || null);
}

export function toInput(value: FieldValues): AssignmentInput {
  return { levelId: value.levelId, startDate: value.startDate || null, endDate: value.endDate || null };
}

interface Props {
  scaleId: string | null;
  value: FieldValues;
  disabled: boolean;
  onChange: (value: FieldValues) => void;
}

// The level of a skill's scale, or no level.
export function LevelField({ scaleId, value, disabled, onChange }: Props) {
  const loadLevels = useCallback(() => (scaleId ? listLevels(scaleId) : Promise.resolve([])), [scaleId]);
  const levels = useAsyncData(loadLevels);

  return (
    <>
      {levels.error && (
        <MessageStrip design="Negative" hideCloseButton>
          {levels.error}
        </MessageStrip>
      )}
      <Label for="assignment-level">Level</Label>
      <Select
        id="assignment-level"
        disabled={disabled || levels.loading}
        onChange={(event) => onChange({ ...value, levelId: event.detail.selectedOption.dataset.id || null })}
      >
        <Option data-id="" selected={value.levelId === null}>
          No level
        </Option>
        {(levels.data ?? []).map((level) => (
          <Option key={level.id} data-id={level.id} selected={level.id === value.levelId}>
            {level.name}
          </Option>
        ))}
      </Select>
    </>
  );
}

// Valid from and valid to. `idPrefix` keeps the field ids unique when the fields are shown per person.
export function ValidityFields({ value, disabled, onChange, idPrefix = "valid" }: Omit<Props, "scaleId"> & { idPrefix?: string }) {
  const dateError = fieldsError(value);
  const startError = dateError?.startsWith("Valid from") ? dateError : null;
  const endError = startError ? null : dateError;

  return (
    <>
      <div className={styles.dates}>
        <div>
          <Label for={`${idPrefix}-from`}>Valid from</Label>
          <DatePicker
            id={`${idPrefix}-from`}
            value={value.startDate}
            valueFormat="yyyy-MM-dd"
            displayFormat="dd.MM.yyyy"
            placeholder="Today if empty"
            showClearIcon
            disabled={disabled}
            valueState={startError ? "Negative" : "None"}
            valueStateMessage={startError ? <span>{startError}</span> : undefined}
            onChange={(event) => onChange({ ...value, startDate: event.detail.value })}
          />
        </div>
        <div>
          <Label for={`${idPrefix}-to`}>Valid to</Label>
          <DatePicker
            id={`${idPrefix}-to`}
            value={value.endDate}
            valueFormat="yyyy-MM-dd"
            displayFormat="dd.MM.yyyy"
            placeholder="No end date"
            showClearIcon
            disabled={disabled}
            valueState={endError ? "Negative" : "None"}
            valueStateMessage={endError ? <span>{endError}</span> : undefined}
            onChange={(event) => onChange({ ...value, endDate: event.detail.value })}
          />
        </div>
      </div>
      {dateError && (
        <Text className={styles.error} role="alert">
          {dateError}
        </Text>
      )}
    </>
  );
}

// Level and validity together, as the dialog for one assignment shows them.
export function AssignmentFields(props: Props) {
  return (
    <>
      <LevelField {...props} />
      <ValidityFields {...props} />
    </>
  );
}
