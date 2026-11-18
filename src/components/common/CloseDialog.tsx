"use client";

import type { ReactNode } from "react";
import { Bar, Button, Dialog } from "@ui5/webcomponents-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

// A dialog that only shows something: a title, the content and Close.
export function CloseDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <Dialog open headerText={title} onClose={onClose} footer={<Bar design="Footer" endContent={<Button onClick={onClose}>{t("action.close")}</Button>} />}>
      {children}
    </Dialog>
  );
}
