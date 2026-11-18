"use client";

import { useState } from "react";
import "@ui5/webcomponents-fiori/dist/illustrations/NoEntries.js";
import { IllustratedMessage, Title, ToolbarButton } from "@ui5/webcomponents-react";
import { AssignmentDialog } from "@/components/assignment/AssignmentDialog";
import { CertificateDialog } from "@/components/assignment/CertificateDialog";
import shell from "@/components/common/AppShell.module.css";
import { PageToolbar } from "@/components/common/PageToolbar";
import { LoadError, Loading } from "@/components/common/LoadState";
import { useSort, type SortColumn } from "@/components/common/useSort";
import { useToast } from "@/components/common/useToast";
import { useAsyncData } from "@/hooks/useAsyncData";
import { alreadyExpired, daysUntil, dueText, expiringWithin } from "@/lib/domain/expiry";
import { filterPersons, indexAssignments, levelNamesOf } from "@/lib/domain/matrix";
import { formatDate, todayIso } from "@/lib/domain/status";
import { loadMatrixData } from "@/lib/fsm/services/matrix";
import type { Assignment, Person, Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { EXPIRED, ExpiryFilters, NO_FILTER } from "./ExpiryFilters";
import { ExpiryTable } from "./ExpiryTable";
import { RenewDialog } from "./RenewDialog";

const SORT_COLUMNS: SortColumn[] = [
  { key: "validTo", label: "field.validTo" },
  { key: "person", label: "field.person" },
  { key: "skill", label: "field.skill" },
  { key: "level", label: "field.level" },
  { key: "certificate", label: "field.certificate" },
];

// What runs out soon, soonest first, or what has already expired. The edit button of a row
// opens the same dialog as a matrix cell, so an assignment can be renewed from here. Ticked
// rows are renewed together.
export function ExpiryList() {
  const { data, error, loading, reload } = useAsyncData(loadMatrixData);
  const [filter, setFilter] = useState(NO_FILTER);
  const { days, search, levels, certificate: certificateFilter } = filter;
  const [selected, setSelected] = useState<{ assignment: Assignment; person: Person; skill: Skill } | null>(null);
  const [viewed, setViewed] = useState<Assignment | null>(null);
  const [tickedIds, setTickedIds] = useState<string[]>([]);
  const [renewing, setRenewing] = useState(false);
  const sort = useSort();
  const { toastElement, showToast } = useToast();
  const { t } = useI18n();

  if (!data) return error ? <LoadError message={error} onRetry={reload} /> : <Loading />;

  const today = todayIso();
  const skillIds = filter.skillIds.filter((id) => data.skills.some((s) => s.id === id));
  const persons = filterPersons(data.persons, search, true);
  const person = (assignment: Assignment) => persons.find((p) => p.id === assignment.personId);
  const skill = (assignment: Assignment) => data.skills.find((s) => s.id === assignment.skillId);
  const hasCertificate = (assignment: Assignment) => data.certificates.some((certificate) => certificate.assignmentId === assignment.id);
  const certificatesOf = (assignment: Assignment) => data.certificates.filter((certificate) => certificate.assignmentId === assignment.id);
  // One assignment per person and skill, the one the matrix shows: a renewed skill is not listed as expired.
  const shownAssignments = [...indexAssignments(data.assignments, today).values()];
  const inPeriod = days === EXPIRED ? alreadyExpired(shownAssignments, today) : expiringWithin(shownAssignments, today, days);
  const matching = inPeriod.filter(
    (assignment) =>
      person(assignment) &&
      skill(assignment) &&
      (skillIds.length === 0 || skillIds.includes(assignment.skillId)) &&
      (levels.length === 0 || levels.includes(assignment.levelName ?? "")) &&
      (certificateFilter.length !== 1 || hasCertificate(assignment) === (certificateFilter[0] === "with")),
  );
  const rows = sort.apply(matching, {
    validTo: (assignment) => assignment.endDate ?? "",
    person: (assignment) => person(assignment)?.displayName ?? "",
    skill: (assignment) => skill(assignment)?.name ?? "",
    level: (assignment) => assignment.level ?? 0,
    certificate: (assignment) => certificatesOf(assignment).length,
  });
  const due = (assignment: Assignment) => {
    const message = dueText(daysUntil(assignment.endDate!, today));
    return t(message.key, message.params);
  };
  const levelNames = levelNamesOf(data.assignments);
  const title = t(days === EXPIRED ? "expiry.titleExpired" : "expiry.title", { count: rows.length });
  // Only rows that are still listed count: a filter or a reload can take a ticked row away.
  const ticked = rows.filter((assignment) => tickedIds.includes(assignment.id));
  const tick = (id: string) => setTickedIds(tickedIds.includes(id) ? tickedIds.filter((ticked) => ticked !== id) : [...tickedIds, id]);

  const exportRows = () => [
    [t("field.validTo"), t("expiry.ends"), t("field.person"), t("field.skill"), t("field.level"), t("field.certificate")],
    ...rows.map((assignment) => [
      formatDate(assignment.endDate!),
      due(assignment),
      person(assignment)!.displayName,
      skill(assignment)!.name,
      assignment.levelName ?? "",
      t(hasCertificate(assignment) ? "common.yes" : "common.no"),
    ]),
  ];

  return (
    <div className={shell.panel}>
      <div className={shell.header}>
        <Title level="H3">{title}</Title>
        <PageToolbar
          name="expiring-assignments"
          getRows={exportRows}
          canExport={rows.length > 0}
          loading={loading}
          onRefresh={reload}
          onError={showToast}
          sorting={{ columns: SORT_COLUMNS, sort }}
        >
          {rows.length > 0 && (
            <ToolbarButton
              design="Emphasized"
              overflowPriority="NeverOverflow"
              icon="history"
              text={ticked.length === 0 ? t("renew.buttonNone") : t("renew.button", { count: ticked.length })}
              tooltip={t("renew.tooltip")}
              disabled={ticked.length === 0}
              onClick={() => setRenewing(true)}
            />
          )}
        </PageToolbar>
      </div>
      {error && <LoadError message={error} onRetry={reload} />}

      <ExpiryFilters value={{ ...filter, skillIds }} skills={data.skills} levelNames={levelNames} onChange={setFilter} />

      {rows.length === 0 ? (
        <IllustratedMessage
          name="NoEntries"
          titleText={t(days === EXPIRED ? "expiry.emptyExpiredTitle" : "expiry.emptyTitle")}
          subtitleText={days === EXPIRED ? t("expiry.emptyExpiredText") : t("expiry.emptyText", { count: days })}
        />
      ) : (
        <ExpiryTable
          title={title}
          rows={rows.map((assignment) => ({ assignment, person: person(assignment)!, skill: skill(assignment)! }))}
          loading={loading}
          sort={sort}
          tickedIds={tickedIds}
          dueOf={due}
          hasCertificate={hasCertificate}
          onTick={tick}
          onView={setViewed}
          onEdit={setSelected}
        />
      )}

      {selected && (
        <AssignmentDialog
          person={selected.person}
          skill={selected.skill}
          assignment={selected.assignment}
          certificates={data.certificates.filter((certificate) => certificate.assignmentId === selected.assignment.id)}
          onClose={() => setSelected(null)}
          onSaved={(message) => {
            setSelected(null);
            showToast(message);
            reload();
          }}
          onChanged={reload}
        />
      )}
      {renewing && (
        <RenewDialog
          rows={ticked.map((assignment) => ({ assignment, person: person(assignment)!, skill: skill(assignment)! }))}
          onClose={() => setRenewing(false)}
          onSaved={(message) => {
            setRenewing(false);
            setTickedIds([]);
            showToast(message);
            reload();
          }}
          onChanged={reload}
        />
      )}
      {viewed && (
        <CertificateDialog
          title={t("expiry.certificateTitle", { person: person(viewed)?.displayName ?? "", skill: skill(viewed)?.name ?? "" })}
          certificates={certificatesOf(viewed)}
          onClose={() => setViewed(null)}
        />
      )}
      {toastElement}
    </div>
  );
}
