"use client";

import { useState } from "react";
import "@ui5/webcomponents-fiori/dist/illustrations/NoEntries.js";
import {
  Bar,
  Button,
  Icon,
  IllustratedMessage,
  Input,
  Label,
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
import shell from "@/components/common/AppShell.module.css";
import { ExportButton } from "@/components/common/ExportDialog";
import { LoadError, Loading } from "@/components/common/LoadState";
import { useToast } from "@/components/common/useToast";
import { useAsyncData } from "@/hooks/useAsyncData";
import { daysUntil, dueText, expiringWithin } from "@/lib/domain/expiry";
import { filterPersons } from "@/lib/domain/matrix";
import { formatDate, todayIso } from "@/lib/domain/status";
import { loadMatrixData } from "@/lib/fsm/services/matrix";
import type { Assignment, Person, Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./ExpiryList.module.css";

const WINDOWS = [30, 60, 90, 180];

// Everything that runs out soon, soonest first. A row opens the same dialog as a matrix cell,
// so an assignment can be renewed from here.
export function ExpiryList() {
  const { data, error, loading, reload } = useAsyncData(loadMatrixData);
  const [days, setDays] = useState(WINDOWS[0]);
  const [search, setSearch] = useState("");
  const [pickedSkillIds, setSkillIds] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [noCertificate, setNoCertificate] = useState(false);
  const [selected, setSelected] = useState<{ assignment: Assignment; person: Person; skill: Skill } | null>(null);
  const { toastElement, showToast } = useToast();
  const { t } = useI18n();

  if (!data) return error ? <LoadError message={error} onRetry={reload} /> : <Loading />;

  const today = todayIso();
  const skillIds = pickedSkillIds.filter((id) => data.skills.some((s) => s.id === id));
  const persons = filterPersons(data.persons, search, true);
  const person = (assignment: Assignment) => persons.find((p) => p.id === assignment.personId);
  const skill = (assignment: Assignment) => data.skills.find((s) => s.id === assignment.skillId);
  const hasCertificate = (assignment: Assignment) => data.certificates.some((certificate) => certificate.assignmentId === assignment.id);
  const rows = expiringWithin(data.assignments, today, days).filter(
    (assignment) =>
      person(assignment) &&
      skill(assignment) &&
      (skillIds.length === 0 || skillIds.includes(assignment.skillId)) &&
      (levels.length === 0 || levels.includes(assignment.levelName ?? "")) &&
      (!noCertificate || !hasCertificate(assignment)),
  );
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
    <div className={`${shell.panel} ${shell.narrow}`}>
      <Bar
        design="Header"
        startContent={<Title level="H3">{t("expiry.title", { count: rows.length })}</Title>}
        endContent={
          <span className={styles.actions}>
            <Label for="expiry-window">{t("expiry.next")}</Label>
            <Select id="expiry-window" onChange={(event) => setDays(Number(event.detail.selectedOption.dataset.days))}>
              {WINDOWS.map((window) => (
                <Option key={window} data-days={window} selected={window === days}>
                  {t("expiry.days", { count: window })}
                </Option>
              ))}
            </Select>
            {rows.length > 0 && <ExportButton name="expiring-assignments" getRows={exportRows} onError={showToast} />}
            <Button icon="refresh" tooltip={t("action.refreshTooltip")} disabled={loading} onClick={reload}>
              {t("action.refresh")}
            </Button>
          </span>
        }
      />
      {error && <LoadError message={error} onRetry={reload} />}

      <div className={styles.filters}>
        <Input
          className={styles.search}
          placeholder={t("filter.searchPerson")}
          accessibleName={t("filter.searchPerson")}
          showClearIcon
          icon={<Icon name="search" />}
          value={search}
          onInput={(event) => setSearch(event.target.value)}
        />
        <MultiComboBox
          className={styles.skills}
          placeholder={t("filter.bySkills")}
          accessibleName={t("filter.bySkills")}
          onSelectionChange={(event) => setSkillIds(event.detail.items.map((item) => item.dataset.id ?? ""))}
        >
          {data.skills.map((s) => (
            <MultiComboBoxItem key={s.id} text={s.name} data-id={s.id} selected={skillIds.includes(s.id)} />
          ))}
        </MultiComboBox>
        {levelNames.length > 0 && (
          <MultiComboBox
            className={styles.levels}
            placeholder={t("filter.byLevel")}
            accessibleName={t("filter.byLevel")}
            onSelectionChange={(event) => setLevels(event.detail.items.map((item) => item.text ?? ""))}
          >
            {levelNames.map((name) => (
              <MultiComboBoxItem key={name} text={name} selected={levels.includes(name)} />
            ))}
          </MultiComboBox>
        )}
        <Button
          tooltip={t("expiry.noCertificateHelp")}
          design={noCertificate ? "Emphasized" : "Default"}
          icon={noCertificate ? "accept" : undefined}
          accessibleName={t(noCertificate ? "filter.on" : "filter.off", { label: t("filter.noCertificate") })}
          onClick={() => setNoCertificate(!noCertificate)}
        >
          {t("filter.noCertificate")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <IllustratedMessage name="NoEntries" titleText={t("expiry.emptyTitle")} subtitleText={t("expiry.emptyText", { count: days })} />
      ) : (
        <Table
          loading={loading}
          accessibleName={t("expiry.tableName")}
          overflowMode="Popin"
          headerRow={
            <TableHeaderRow>
              <TableHeaderCell width="8rem">{t("field.validTo")}</TableHeaderCell>
              <TableHeaderCell width="8rem">{t("expiry.ends")}</TableHeaderCell>
              <TableHeaderCell minWidth="12rem">{t("field.person")}</TableHeaderCell>
              <TableHeaderCell minWidth="12rem">{t("field.skill")}</TableHeaderCell>
              <TableHeaderCell width="8rem">{t("field.level")}</TableHeaderCell>
              <TableHeaderCell width="7rem" horizontalAlign="Center">
                {t("field.certificate")}
              </TableHeaderCell>
              <TableHeaderCell width="6rem" horizontalAlign="End">
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
              <TableCell horizontalAlign="Center">
                {hasCertificate(assignment) && <Icon name="attachment" accessibleName={t("cell.hasCertificate")} showTooltip />}
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
      {toastElement}
    </div>
  );
}
