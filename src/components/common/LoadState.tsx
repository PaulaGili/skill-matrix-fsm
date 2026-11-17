"use client";

import { BusyIndicator, Button, MessageStrip } from "@ui5/webcomponents-react";
import styles from "./LoadState.module.css";

export function Loading() {
  return (
    <div className={styles.center}>
      <BusyIndicator active delay={0} size="L" />
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.error}>
      <MessageStrip design="Negative" hideCloseButton>
        {message}
      </MessageStrip>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  );
}
