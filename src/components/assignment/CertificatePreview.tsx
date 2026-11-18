"use client";

import { useEffect, useState } from "react";
import { BusyIndicator, Text } from "@ui5/webcomponents-react";
import { certificateUrl } from "@/lib/fsm/services/certificates";
import type { Certificate } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./AssignmentDialog.module.css";

// FSM serves attachments as downloads, so the file is loaded here and shown from memory.
export function CertificatePreview({ certificate }: { certificate: Certificate }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const isPdf = certificate.type === "PDF";
  const { t } = useI18n();
  const title = t("certificate.previewOf", { file: certificate.fileName });

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetch(certificateUrl(certificate))
      .then((response) => (response.ok ? response.blob() : Promise.reject()))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: isPdf ? "application/pdf" : blob.type }));
        setUrl(objectUrl);
      })
      .catch(() => cancelled || setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [certificate, isPdf]);

  if (failed) return <Text className={styles.error}>{t("certificate.previewFailed")}</Text>;
  if (!url) return <BusyIndicator active delay={0} />;
  return isPdf ? (
    // Without the page list of the browser's PDF viewer, the page itself gets the room.
    <iframe className={styles.preview} src={`${url}#navpanes=0`} title={title} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- a blob URL, not a static asset
    <img className={styles.preview} src={url} alt={title} />
  );
}
