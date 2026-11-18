"use client";

import { useState } from "react";
import { Button, FileUploader, Link, Title } from "@ui5/webcomponents-react";
import { CERTIFICATE_ACCEPT, checkCertificateFile } from "@/lib/domain/certificate";
import { formatDate, todayIso } from "@/lib/domain/status";
import { certificateUrl } from "@/lib/fsm/services/certificates";
import type { Certificate } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { CertificateDialog } from "./CertificateDialog";
import styles from "./AssignmentDialog.module.css";

interface Props {
  certificates: Certificate[];
  removedIds: string[];
  newFiles: File[];
  disabled: boolean;
  onToggleRemoved: (id: string) => void;
  onNewFiles: (files: File[]) => void;
  onRejected: (messages: string[]) => void;
  onRead?: (file: File) => void; // read the dates with AI, only when it is configured
}

// Existing certificates can be opened or marked for deletion, and new files are queued.
// Nothing is written until the dialog is saved.
export function CertificateSection({ certificates, removedIds, newFiles, disabled, onToggleRemoved, onNewFiles, onRejected, onRead }: Props) {
  const [viewed, setViewed] = useState<Certificate | null>(null);
  const { t } = useI18n();

  function addFiles(selected: FileList | null) {
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(selected ?? [])) {
      const check = checkCertificateFile(file.name, file.size);
      if (check.ok) accepted.push(file);
      else rejected.push(`${file.name}: ${t(check.error.key)}`);
    }
    onNewFiles([...newFiles, ...accepted]);
    onRejected(rejected);
  }

  return (
    <>
      <Title level="H5" className={styles.sectionTitle}>
        {t("certificate.title", { count: certificates.length - removedIds.length + newFiles.length })}
      </Title>
      <ul className={styles.files}>
        {certificates.map((certificate) => {
          const removed = removedIds.includes(certificate.id);
          return (
            <li key={certificate.id}>
              <Link className={`${styles.fileName} ${removed ? styles.removed : ""}`} href={certificateUrl(certificate)} target="_blank">
                {certificate.fileName}
              </Link>
              <span className={styles.hint}>{certificate.createdAt ? formatDate(todayIso(new Date(certificate.createdAt))) : ""}</span>
              <Button
                design="Transparent"
                icon="show"
                accessibleName={t("certificate.showPreviewOf", { file: certificate.fileName })}
                tooltip={t("certificate.showPreview")}
                onClick={() => setViewed(certificate)}
              />
              <Button
                design="Transparent"
                icon={removed ? "undo" : "delete"}
                disabled={disabled}
                accessibleName={t(removed ? "certificate.keepFile" : "certificate.deleteFile", { file: certificate.fileName })}
                tooltip={t(removed ? "action.keep" : "action.delete")}
                onClick={() => onToggleRemoved(certificate.id)}
              />
            </li>
          );
        })}
        {newFiles.map((file, index) => (
          <li key={`${file.name}-${index}`}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.hint}>{t("certificate.new")}</span>
            {onRead && (
              <Button design="Transparent" icon="ai" disabled={disabled} tooltip={t("certificate.readTooltip")} onClick={() => onRead(file)}>
                {t("certificate.readDates")}
              </Button>
            )}
            <Button
              design="Transparent"
              icon="decline"
              disabled={disabled}
              accessibleName={t("certificate.removeFile", { file: file.name })}
              tooltip={t("action.remove")}
              onClick={() => onNewFiles(newFiles.filter((_, i) => i !== index))}
            />
          </li>
        ))}
      </ul>
      {viewed && <CertificateDialog title={t("field.certificate")} certificates={[viewed]} onClose={() => setViewed(null)} />}
      <FileUploader hideInput multiple accept={CERTIFICATE_ACCEPT} disabled={disabled} onChange={(event) => addFiles(event.detail.files)}>
        <Button icon="add" disabled={disabled}>
          {t("certificate.addFiles")}
        </Button>
      </FileUploader>
      <span className={styles.hint}>{t("certificate.fileHint")}</span>
    </>
  );
}
