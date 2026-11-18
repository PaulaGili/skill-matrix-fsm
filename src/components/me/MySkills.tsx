"use client";

import { useMemo, useState } from "react";
import { FilterBar, FilterGroupItem, Option, Select } from "@ui5/webcomponents-react";
import shell from "@/components/common/AppShell.module.css";
import { LoadError, Loading } from "@/components/common/LoadState";
import { AssignmentsTable } from "@/components/common/AssignmentsTable";
import { useAsyncData } from "@/hooks/useAsyncData";
import { buildCells, cellKey, filterPersons } from "@/lib/domain/matrix";
import { todayIso } from "@/lib/domain/status";
import { loadMatrixData } from "@/lib/fsm/services/matrix";
import { useI18n } from "@/lib/i18n/I18nProvider";

const ME_KEY = "me:personId";
function loadMe(): string {
  try {
    return localStorage.getItem(ME_KEY) ?? "";
  } catch {
    return "";
  }
}

// The view of a technician: the own skills, their validity and the certificates, read-only.
// The app has no login, so the technician picks the name once and the browser remembers it.
export function MySkills() {
  const { data, error, reload } = useAsyncData(loadMatrixData);
  const [personId, setPersonId] = useState(loadMe);
  const { t } = useI18n();
  const today = todayIso();
  const cells = useMemo(
    () => buildCells(data?.assignments ?? [], new Set(data?.certificates.map((certificate) => certificate.assignmentId)), today),
    [data, today],
  );

  if (!data) return error ? <LoadError message={error} onRetry={reload} /> : <Loading />;

  const technicians = filterPersons(data.persons, "", false);
  const me = technicians.find((person) => person.id === personId);

  function choose(id: string) {
    setPersonId(id);
    try {
      localStorage.setItem(ME_KEY, id);
    } catch {}
  }

  const rows = me
    ? data.skills.flatMap((skill) => {
        const cell = cells.get(cellKey(me.id, skill.id));
        return cell ? [{ name: skill.name, personName: me.displayName, skillName: skill.name, assignment: cell.assignment, status: cell.status }] : [];
      })
    : [];

  return (
    <div className={shell.panel}>
      {error && <LoadError message={error} onRetry={reload} />}
      <AssignmentsTable
        exportName="my-skills"
        title={t("me.title", { count: rows.length })}
        emptyText={me ? t("person.none") : t("me.choose")}
        firstColumn="field.skill"
        rows={rows}
        certificates={data.certificates}
        filters={
          <FilterBar className={shell.filterBar} filterContainerWidth="13rem" hideFilterConfiguration hideToggleFiltersButton hideToolbar>
            <FilterGroupItem filterKey="person" label={t("field.person")}>
              <Select id="me-person" accessibleName={t("me.choose")} onChange={(event) => choose(event.detail.selectedOption.dataset.id ?? "")}>
                <Option data-id="" selected={!me}>
                  {t("me.choose")}
                </Option>
                {technicians.map((person) => (
                  <Option key={person.id} data-id={person.id} selected={person.id === me?.id}>
                    {person.displayName}
                  </Option>
                ))}
              </Select>
            </FilterGroupItem>
          </FilterBar>
        }
      />
    </div>
  );
}
