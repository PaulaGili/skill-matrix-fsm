"use client";

import { useEffect, useState } from "react";
import { BusyIndicator, Text } from "@ui5/webcomponents-react";
import { certificateUrl } from "@/lib/fsm/services/certificates";
import type { Certificate } from "@/lib/fsm/services/model";
import styles from "./AssignmentDialog.module.css";

// FSM serves attachments as downloads, so the file is loaded here and shown from memory.
export function CertificatePreview({ certificate }: { certificate: Certificate }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const isPdf = certificate.type === "PDF";

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

  if (failed) return <Text className={styles.error}>The preview could not be loaded. Open the file instead.</Text>;
  if (!url) return <BusyIndicator active delay={0} />;
  return isPdf ? (
    <iframe className={styles.preview} src={url} title={`Preview of ${certificate.fileName}`} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- a blob URL, not a static asset
    <img className={styles.preview} src={url} alt={`Preview of ${certificate.fileName}`} />
  );
}
