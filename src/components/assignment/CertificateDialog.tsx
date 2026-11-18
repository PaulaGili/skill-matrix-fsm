"use client";

import { Bar, Button, Dialog, Title } from "@ui5/webcomponents-react";
import type { Certificate } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { CertificatePreview } from "./CertificatePreview";
import styles from "./AssignmentDialog.module.css";

// The certificate viewer: one or more files of an assignment in a dialog of their own.
export function CertificateDialog({ title, certificates, onClose }: { title: string; certificates: Certificate[]; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog open headerText={title} onClose={onClose} footer={<Bar design="Footer" endContent={<Button onClick={onClose}>{t("action.close")}</Button>} />}>
      <div className={styles.viewer}>
        {certificates.map((certificate) => (
          <div key={certificate.id}>
            <Title level="H6">{certificate.fileName}</Title>
            <CertificatePreview certificate={certificate} />
          </div>
        ))}
      </div>
    </Dialog>
  );
}
