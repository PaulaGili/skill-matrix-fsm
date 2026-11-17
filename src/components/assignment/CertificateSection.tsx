"use client";

import { Button, FileUploader, Link, Title } from "@ui5/webcomponents-react";
import { CERTIFICATE_ACCEPT, checkCertificateFile } from "@/lib/domain/certificate";
import { formatDate } from "@/lib/domain/status";
import { certificateUrl } from "@/lib/fsm/services/certificates";
import type { Certificate } from "@/lib/fsm/services/model";
import styles from "./AssignmentDialog.module.css";

interface Props {
  certificates: Certificate[];
  removedIds: string[];
  newFiles: File[];
  disabled: boolean;
  onToggleRemoved: (id: string) => void;
  onNewFiles: (files: File[]) => void;
  onRejected: (messages: string[]) => void;
}

// Existing certificates can be opened or marked for deletion, and new files are queued.
// Nothing is written until the dialog is saved.
export function CertificateSection({ certificates, removedIds, newFiles, disabled, onToggleRemoved, onNewFiles, onRejected }: Props) {
  function addFiles(selected: FileList | null) {
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(selected ?? [])) {
      const check = checkCertificateFile(file.name, file.size);
      if (check.ok) accepted.push(file);
      else rejected.push(check.error);
    }
    onNewFiles([...newFiles, ...accepted]);
    onRejected(rejected);
  }

  return (
    <>
      <Title level="H5" className={styles.sectionTitle}>
        Certificates ({certificates.length - removedIds.length + newFiles.length})
      </Title>
      <ul className={styles.files}>
        {certificates.map((certificate) => {
          const removed = removedIds.includes(certificate.id);
          return (
            <li key={certificate.id}>
              <Link className={`${styles.fileName} ${removed ? styles.removed : ""}`} href={certificateUrl(certificate)} target="_blank">
                {certificate.fileName}
              </Link>
              <span className={styles.hint}>{certificate.createdAt ? formatDate(certificate.createdAt.slice(0, 10)) : ""}</span>
              <Button
                design="Transparent"
                icon={removed ? "undo" : "delete"}
                disabled={disabled}
                accessibleName={`${removed ? "Keep" : "Delete"} ${certificate.fileName}`}
                tooltip={removed ? "Keep" : "Delete"}
                onClick={() => onToggleRemoved(certificate.id)}
              />
            </li>
          );
        })}
        {newFiles.map((file, index) => (
          <li key={`${file.name}-${index}`}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.hint}>new</span>
            <Button
              design="Transparent"
              icon="decline"
              disabled={disabled}
              accessibleName={`Remove ${file.name}`}
              tooltip="Remove"
              onClick={() => onNewFiles(newFiles.filter((_, i) => i !== index))}
            />
          </li>
        ))}
      </ul>
      <FileUploader hideInput multiple accept={CERTIFICATE_ACCEPT} disabled={disabled} onChange={(event) => addFiles(event.detail.files)}>
        <Button icon="add" disabled={disabled}>
          Add files
        </Button>
      </FileUploader>
      <span className={styles.hint}>PDF, JPG or PNG, up to 5 MB each.</span>
    </>
  );
}
