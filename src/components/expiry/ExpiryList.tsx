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
  const levelNames = [...new Set(data.assignments.map((assignment) => assignment.levelName).filter((name) => name !== null))];

  const exportRows = () => [
    ["Valid to", "Ends", "Person", "Skill", "Level", "Certificate"],
    ...rows.map((assignment) => [
      formatDate(assignment.endDate!),
      dueText(daysUntil(assignment.endDate!, today)),
      person(assignment)!.displayName,
      skill(assignment)!.name,
      assignment.levelName ?? "",
      hasCertificate(assignment) ? "yes" : "no",
    ]),
  ];

  return (
    <div className={shell.panel}>
      <Bar
        design="Header"
        startContent={<Title level="H3">Expiring assignments ({rows.length})</Title>}
        endContent={
          <span className={styles.actions}>
            <Label for="expiry-window">Next</Label>
            <Select id="expiry-window" onChange={(event) => setDays(Number(event.detail.selectedOption.dataset.days))}>
              {WINDOWS.map((window) => (
                <Option key={window} data-days={window} selected={window === days}>
                  {window} days
                </Option>
              ))}
            </Select>
            {rows.length > 0 && <ExportButton name="expiring-assignments" getRows={exportRows} onError={showToast} />}
            <Button icon="refresh" tooltip="Load the current data from SAP FSM" disabled={loading} onClick={reload}>
              Refresh
            </Button>
          </span>
        }
      />
      {error && <LoadError message={error} onRetry={reload} />}

      <div className={styles.filters}>
        <Input
          className={styles.search}
          placeholder="Search person"
          accessibleName="Search person"
          showClearIcon
          icon={<Icon name="search" />}
          value={search}
          onInput={(event) => setSearch(event.target.value)}
        />
        <MultiComboBox
          className={styles.skills}
          placeholder="Filter by skills"
          accessibleName="Filter by skills"
          onSelectionChange={(event) => setSkillIds(event.detail.items.map((item) => item.dataset.id ?? ""))}
        >
          {data.skills.map((s) => (
            <MultiComboBoxItem key={s.id} text={s.name} data-id={s.id} selected={skillIds.includes(s.id)} />
          ))}
        </MultiComboBox>
        {levelNames.length > 0 && (
          <MultiComboBox
            className={styles.levels}
            placeholder="Filter by level"
            accessibleName="Filter by level"
            onSelectionChange={(event) => setLevels(event.detail.items.map((item) => item.text ?? ""))}
          >
            {levelNames.map((name) => (
              <MultiComboBoxItem key={name} text={name} selected={levels.includes(name)} />
            ))}
          </MultiComboBox>
        )}
        <Button
          tooltip="Only assignments that have no certificate attached"
          design={noCertificate ? "Emphasized" : "Default"}
          icon={noCertificate ? "accept" : undefined}
          accessibleName={`No certificate, ${noCertificate ? "filter on" : "filter off"}`}
          onClick={() => setNoCertificate(!noCertificate)}
        >
          No certificate
        </Button>
      </div>

      {rows.length === 0 ? (
        <IllustratedMessage
          name="NoEntries"
          titleText="Nothing expires soon"
          subtitleText={`No assignment that matches the filters ends in the next ${days} days.`}
        />
      ) : (
        <Table
          loading={loading}
          accessibleName="Expiring assignments"
          overflowMode="Popin"
          headerRow={
            <TableHeaderRow>
              <TableHeaderCell width="8rem">Valid to</TableHeaderCell>
              <TableHeaderCell width="8rem">Ends</TableHeaderCell>
              <TableHeaderCell minWidth="12rem">Person</TableHeaderCell>
              <TableHeaderCell minWidth="12rem">Skill</TableHeaderCell>
              <TableHeaderCell width="8rem">Level</TableHeaderCell>
              <TableHeaderCell width="7rem" horizontalAlign="Center">
                Certificate
              </TableHeaderCell>
              <TableHeaderCell width="6rem" horizontalAlign="End">
                Actions
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
                <Text>{dueText(daysUntil(assignment.endDate!, today))}</Text>
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
                {hasCertificate(assignment) && <Icon name="attachment" accessibleName="Has certificate" showTooltip />}
              </TableCell>
              <TableCell horizontalAlign="End">
                <Button
                  design="Transparent"
                  icon="edit"
                  accessibleName={`Edit ${skill(assignment)!.name} of ${person(assignment)!.displayName}`}
                  tooltip="Edit or renew"
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
