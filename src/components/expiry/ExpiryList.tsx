"use client";

import { useState } from "react";
import "@ui5/webcomponents-fiori/dist/illustrations/NoEntries.js";
import {
  Button,
  FilterBar,
  FilterGroupItem,
  Icon,
  IllustratedMessage,
  Input,
  MultiComboBox,
  MultiComboBoxItem,
  Option,
  Select,
  Table,
  TableCell,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
  Text,
  Title,
} from "@ui5/webcomponents-react";
import { AssignmentDialog } from "@/components/assignment/AssignmentDialog";
import { CertificateDialog } from "@/components/assignment/CertificateDialog";
import shell from "@/components/common/AppShell.module.css";
import { PageToolbar } from "@/components/common/PageToolbar";
import { LoadError, Loading } from "@/components/common/LoadState";
import { useSort, type SortColumn } from "@/components/common/useSort";
import { useToast } from "@/components/common/useToast";
import { useAsyncData } from "@/hooks/useAsyncData";
import { alreadyExpired, daysUntil, dueText, expiringWithin } from "@/lib/domain/expiry";
import { filterPersons, indexAssignments } from "@/lib/domain/matrix";
import { formatDate, todayIso } from "@/lib/domain/status";
import { loadMatrixData } from "@/lib/fsm/services/matrix";
import type { Assignment, Person, Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";

const SORT_COLUMNS: SortColumn[] = [
  { key: "validTo", label: "field.validTo" },
  { key: "person", label: "field.person" },
  { key: "skill", label: "field.skill" },
  { key: "level", label: "field.level" },
  { key: "certificate", label: "field.certificate" },
];

// 0 stands for what has already expired.
const EXPIRED = 0;
const WINDOWS = [30, 60, 90, 180, EXPIRED];

// What runs out soon, soonest first, or what has already expired. The edit button of a row
// opens the same dialog as a matrix cell, so an assignment can be renewed from here.
export function ExpiryList() {
  const { data, error, loading, reload } = useAsyncData(loadMatrixData);
  const [days, setDays] = useState(WINDOWS[0]);
  const [search, setSearch] = useState("");
  const [pickedSkillIds, setSkillIds] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [certificateFilter, setCertificateFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<{ assignment: Assignment; person: Person; skill: Skill } | null>(null);
  const [viewed, setViewed] = useState<Assignment | null>(null);
  const sort = useSort();
  const { toastElement, showToast } = useToast();
  const { t } = useI18n();

  if (!data) return error ? <LoadError message={error} onRetry={reload} /> : <Loading />;

  const today = todayIso();
  const skillIds = pickedSkillIds.filter((id) => data.skills.some((s) => s.id === id));
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
  const levelNames = [...new Set(data.assignments.map((assignment) => assignment.levelName).filter((name) => name !== null))];

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
        <Title level="H3">{t(days === EXPIRED ? "expiry.titleExpired" : "expiry.title", { count: rows.length })}</Title>
        <PageToolbar
          name="expiring-assignments"
          getRows={exportRows}
          canExport={rows.length > 0}
          loading={loading}
          onRefresh={reload}
          onError={showToast}
          sorting={{ columns: SORT_COLUMNS, sort }}
        />
      </div>
      {error && <LoadError message={error} onRetry={reload} />}

      <FilterBar
        className={shell.filterBar}
        filterContainerWidth="13rem"
        hideFilterConfiguration
        hideToggleFiltersButton
        hideToolbar
        showClearOnFB={search !== "" || skillIds.length > 0 || levels.length > 0 || certificateFilter.length > 0}
        onClear={() => {
          setSearch("");
          setSkillIds([]);
          setLevels([]);
          setCertificateFilter([]);
        }}
      >
        <FilterGroupItem filterKey="period" label={t("expiry.period")}>
          <Select id="expiry-window" accessibleName={t("expiry.period")} onChange={(event) => setDays(Number(event.detail.selectedOption.dataset.days))}>
            {WINDOWS.map((window) => (
              <Option key={window} data-days={window} selected={window === days}>
                {window === EXPIRED ? t("expiry.expired") : t("expiry.days", { count: window })}
              </Option>
            ))}
          </Select>
        </FilterGroupItem>
        <FilterGroupItem filterKey="person" label={t("field.person")}>
          <Input
            placeholder={t("filter.searchPerson")}
            accessibleName={t("filter.searchPerson")}
            showClearIcon
            icon={<Icon name="search" />}
            value={search}
            onInput={(event) => setSearch(event.target.value)}
          />
        </FilterGroupItem>
        <FilterGroupItem filterKey="skills" label={t("field.skill")}>
          <MultiComboBox
            placeholder={t("filter.bySkills")}
            accessibleName={t("filter.bySkills")}
            onSelectionChange={(event) => setSkillIds(event.detail.items.map((item) => item.dataset.id ?? ""))}
          >
            {data.skills.map((s) => (
              <MultiComboBoxItem key={s.id} text={s.name} data-id={s.id} selected={skillIds.includes(s.id)} />
            ))}
          </MultiComboBox>
        </FilterGroupItem>
        <FilterGroupItem filterKey="level" label={t("field.level")} hiddenInFilterBar={levelNames.length === 0}>
          <MultiComboBox
            placeholder={t("filter.byLevel")}
            accessibleName={t("filter.byLevel")}
            onSelectionChange={(event) => setLevels(event.detail.items.map((item) => item.text ?? ""))}
          >
            {levelNames.map((name) => (
              <MultiComboBoxItem key={name} text={name} selected={levels.includes(name)} />
            ))}
          </MultiComboBox>
        </FilterGroupItem>
        <FilterGroupItem filterKey="certificate" label={t("field.certificate")}>
          <MultiComboBox
            placeholder={t("filter.byCertificate")}
            accessibleName={t("filter.byCertificate")}
            onSelectionChange={(event) => setCertificateFilter(event.detail.items.map((item) => item.dataset.value ?? ""))}
          >
            <MultiComboBoxItem text={t("filter.withCertificate")} data-value="with" selected={certificateFilter.includes("with")} />
            <MultiComboBoxItem text={t("filter.noCertificate")} data-value="without" selected={certificateFilter.includes("without")} />
          </MultiComboBox>
        </FilterGroupItem>
      </FilterBar>

      {rows.length === 0 ? (
        <IllustratedMessage
          name="NoEntries"
          titleText={t(days === EXPIRED ? "expiry.emptyExpiredTitle" : "expiry.emptyTitle")}
          subtitleText={days === EXPIRED ? t("expiry.emptyExpiredText") : t("expiry.emptyText", { count: days })}
        />
      ) : (
        <Table
          loading={loading}
          accessibleName={t(days === EXPIRED ? "expiry.titleExpired" : "expiry.title", { count: rows.length })}
          overflowMode="Popin"
          headerRow={
            <TableHeaderRow>
              <TableHeaderCell minWidth="7rem" importance={2} sortIndicator={sort.indicator("validTo")}>
                {t("field.validTo")}
              </TableHeaderCell>
              <TableHeaderCell minWidth="7rem">{t("expiry.ends")}</TableHeaderCell>
              <TableHeaderCell minWidth="9rem" importance={2} sortIndicator={sort.indicator("person")}>
                {t("field.person")}
              </TableHeaderCell>
              <TableHeaderCell minWidth="9rem" importance={1} sortIndicator={sort.indicator("skill")}>
                {t("field.skill")}
              </TableHeaderCell>
              <TableHeaderCell minWidth="7rem" importance={-1} popinHidden sortIndicator={sort.indicator("level")}>
                {t("field.level")}
              </TableHeaderCell>
              <TableHeaderCell minWidth="6.5rem" importance={-1} popinHidden sortIndicator={sort.indicator("certificate")}>
                {t("field.certificate")}
              </TableHeaderCell>
              <TableHeaderCell width="4.5rem" horizontalAlign="End" importance={2}>
                {t("field.actions")}
              </TableHeaderCell>
            </TableHeaderRow>
          }
        >
          {rows.map((assignment) => (
            <TableRow key={assignment.id} rowKey={assignment.id}>
              <TableCell>
                <Text>{formatDate(assignment.endDate!)}</Text>
              </TableCell>
              <TableCell>
                <Text>{due(assignment)}</Text>
              </TableCell>
              <TableCell>
                <Text>{person(assignment)!.displayName}</Text>
              </TableCell>
              <TableCell>
                <Text>{skill(assignment)!.name}</Text>
              </TableCell>
              <TableCell>
                <Text>{assignment.levelName ?? ""}</Text>
              </TableCell>
              <TableCell>
                {hasCertificate(assignment) && (
                  <Button
                    design="Transparent"
                    icon="attachment"
                    tooltip={t("certificate.showPreview")}
                    accessibleName={t("expiry.showCertificate", { person: person(assignment)!.displayName, skill: skill(assignment)!.name })}
                    onClick={() => setViewed(assignment)}
                  />
                )}
              </TableCell>
              <TableCell horizontalAlign="End">
                <Button
                  design="Transparent"
                  icon="edit"
                  accessibleName={t("expiry.editLabel", { skill: skill(assignment)!.name, person: person(assignment)!.displayName })}
                  tooltip={t("expiry.editTooltip")}
                  onClick={() => setSelected({ assignment, person: person(assignment)!, skill: skill(assignment)! })}
                />
              </TableCell>
            </TableRow>
          ))}
        </Table>
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
