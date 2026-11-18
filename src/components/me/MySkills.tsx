"use client";

import { useMemo, useState } from "react";
import { ComboBox, ComboBoxItem, FilterGroupItem } from "@ui5/webcomponents-react";
import { PageFilters } from "@/components/common/Filters";
import shell from "@/components/common/AppShell.module.css";
import { LoadError, Loading } from "@/components/common/LoadState";
import { AssignmentsTable, rowsOfPerson } from "@/components/common/AssignmentsTable";
import { useAsyncData } from "@/hooks/useAsyncData";
import { buildCells, filterPersons } from "@/lib/domain/matrix";
import { todayIso } from "@/lib/domain/status";
import { loadMatrixData } from "@/lib/fsm/services/matrix";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { readStored, store } from "@/lib/storage";

const ME_KEY = "me:personId";

// The view of a technician: the own skills, their validity and the certificates, read-only.
// The app has no login, so the technician picks the name once and the browser remembers it.
export function MySkills() {
  const { data, error, loading, reload } = useAsyncData(loadMatrixData);
  const [personId, setPersonId] = useState(() => readStored(ME_KEY) ?? "");
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
    store(ME_KEY, id);
  }

  const rows = me ? rowsOfPerson(me, data.skills, cells) : [];

  return (
    <div className={shell.panel}>
      {error && <LoadError message={error} onRetry={reload} />}
      <AssignmentsTable
        exportName="my-skills"
        title={t("me.title", { count: rows.length })}
        emptyText={me ? t("person.none") : t("me.chooseText")}
        firstColumn="field.skill"
        rows={rows}
        certificates={data.certificates}
        loading={loading}
        onRefresh={reload}
        filters={
          <PageFilters>
            <FilterGroupItem filterKey="person" label={t("field.person")} className={shell.filterItem}>
              {/* Typing narrows the list, which matters with many technicians. A pick from the list
                  gives the id. A name that was typed in full is looked up, and an empty field clears. */}
              <ComboBox
                id="me-person"
                placeholder={t("me.choose")}
                accessibleName={t("me.choose")}
                filter="Contains"
                showClearIcon
                value={me?.displayName ?? ""}
                onSelectionChange={(event) => choose(event.detail.item?.dataset.id ?? "")}
                onChange={(event) => {
                  const typed = event.target.value.trim().toLowerCase();
                  if (typed !== (me?.displayName ?? "").toLowerCase())
                    choose(technicians.find((person) => person.displayName.toLowerCase() === typed)?.id ?? "");
                }}
              >
                {technicians.map((person) => (
                  <ComboBoxItem key={person.id} text={person.displayName} data-id={person.id} />
                ))}
              </ComboBox>
            </FilterGroupItem>
          </PageFilters>
        }
      />
    </div>
  );
}
