"use client";

import { Bar, Button, Dialog, Icon, Text, Title } from "@ui5/webcomponents-react";
import { CANDIDATE_ID } from "@/lib/candidate";
import type { AssignmentStatus } from "@/lib/domain/status";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { StatusBadge } from "./StatusBadge";
import styles from "./HelpDialog.module.css";

const STATUSES: AssignmentStatus[] = ["valid", "expiring", "expired", "notYetValid", "unassigned"];

export function HelpDialog({ company, onClose }: { company?: string; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog
      open
      headerText={t("shell.help")}
      onClose={onClose}
      footer={<Bar design="Footer" endContent={<Button onClick={onClose}>{t("action.close")}</Button>} />}
    >
      <div className={styles.help}>
        <Title level="H5">{t("help.statuses")}</Title>
        <dl className={styles.statuses}>
          {STATUSES.map((status) => (
            <div key={status}>
              <dt>
                <StatusBadge status={status} />
              </dt>
              <dd>{t(`statusHelp.${status}`)}</dd>
            </div>
          ))}
          <div>
            <dt>
              <Icon name="attachment" /> {t("field.certificate")}
            </dt>
            <dd>{t("help.certificateText")}</dd>
          </div>
        </dl>

        <Title level="H5">{t("nav.matrix")}</Title>
        <Text>{t("help.matrixCells")}</Text>
        <Text>{t("help.person")}</Text>
        <Text>{t("help.matrixFilters")}</Text>
        <Text>{t("help.sorting")}</Text>
        <Text>{t("help.assignSeveral")}</Text>
        <Text>{t("help.import")}</Text>
        <Text>{t("help.ask")}</Text>

        <Title level="H5">{t("nav.catalog")}</Title>
        <Text>{t("help.catalogText")}</Text>
        <Text>{t("help.catalogRemove")}</Text>

        <Title level="H5">{t("nav.expiry")}</Title>
        <Text>{t("help.expiryText")}</Text>

        <Title level="H5">{t("nav.me")}</Title>
        <Text>{t("help.meText")}</Text>

        <Title level="H5">{t("nav.history")}</Title>
        <Text>{t("help.historyText")}</Text>

        <Title level="H5">{t("shell.language")}</Title>
        <Text>{t("help.languageText")}</Text>

        <Title level="H5">SAP FSM</Title>
        {company && <Text>{t("shell.company", { name: company })}</Text>}
        <Text>{t("shell.namespace", { id: CANDIDATE_ID })}</Text>
      </div>
    </Dialog>
  );
}
