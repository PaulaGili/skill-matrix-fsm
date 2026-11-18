"use client";

import { Title } from "@ui5/webcomponents-react";
import { CloseDialog } from "@/components/common/CloseDialog";
import type { Certificate } from "@/lib/fsm/services/model";
import { CertificatePreview } from "./CertificatePreview";
import styles from "./AssignmentDialog.module.css";

// The certificate viewer: one or more files of an assignment in a dialog of their own.
export function CertificateDialog({ title, certificates, onClose }: { title: string; certificates: Certificate[]; onClose: () => void }) {
  return (
    <CloseDialog title={title} onClose={onClose}>
      <div className={styles.viewer}>
        {certificates.map((certificate) => (
          <div key={certificate.id}>
            <Title level="H6">{certificate.fileName}</Title>
            <CertificatePreview certificate={certificate} />
          </div>
        ))}
      </div>
    </CloseDialog>
  );
}
