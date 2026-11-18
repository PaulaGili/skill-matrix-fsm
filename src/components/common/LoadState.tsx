"use client";

import { BusyIndicator, Button, MessageStrip } from "@ui5/webcomponents-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./LoadState.module.css";

export function Loading() {
  return (
    <div className={styles.center}>
      <BusyIndicator active delay={0} size="L" />
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className={styles.error}>
      <MessageStrip design="Negative" hideCloseButton>
        {message}
      </MessageStrip>
      <Button onClick={onRetry}>{t("action.retry")}</Button>
    </div>
  );
}
