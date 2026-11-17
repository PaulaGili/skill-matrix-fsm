"use client";

import { Bar, Button, Dialog, Icon, Text, Title } from "@ui5/webcomponents-react";
import type { AssignmentStatus } from "@/lib/domain/status";
import { STATUS_HELP, StatusBadge } from "./StatusBadge";
import styles from "./HelpDialog.module.css";

const STATUSES: AssignmentStatus[] = ["valid", "expiring", "expired", "notYetValid", "unassigned"];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open headerText="Help" onClose={onClose} footer={<Bar design="Footer" endContent={<Button onClick={onClose}>Close</Button>} />}>
      <div className={styles.help}>
        <Title level="H5">Statuses</Title>
        <dl className={styles.statuses}>
          {STATUSES.map((status) => (
            <div key={status}>
              <dt>
                <StatusBadge status={status} />
              </dt>
              <dd>{STATUS_HELP[status]}</dd>
            </div>
          ))}
          <div>
            <dt>
              <Icon name="attachment" /> Certificate
            </dt>
            <dd>At least one certificate file is attached to the assignment.</dd>
          </div>
        </dl>

        <Title level="H5">Skill matrix</Title>
        <Text>Each row is a person and each column a skill. Click a cell to assign the skill or to change its level, validity and certificates.</Text>
        <Text>
          Select skills in the filter to see who holds all of them today: Valid and Expiring soon are switched on for you and can be changed. The Show only
          buttons filter by status: several statuses are alternatives, and No certificate adds a condition. With skills selected, the status applies to those
          skills, so Welding and Expired shows whose welding has expired. The level filter works the same way. With a filter on, only the matching assignments
          are shown; the rest of the row is left blank and skills without a match are hidden. Click a button again to switch it off.
        </Text>
        <Text>System users are the login accounts of the same persons. They are hidden unless you switch them on.</Text>

        <Title level="H5">Skill catalogue</Title>
        <Text>
          Create, rename and delete skills. A skill that is still assigned can be retired, which ends its valid assignments and keeps the history and
          certificates, or deleted together with everything attached to it.
        </Text>
      </div>
    </Dialog>
  );
}
