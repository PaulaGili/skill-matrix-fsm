"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon, MessageStrip, SegmentedButton, SegmentedButtonItem, ShellBar, ShellBarItem, Tab, TabContainer } from "@ui5/webcomponents-react";
import { CANDIDATE_ID } from "@/lib/candidate";
import { HelpDialog } from "./HelpDialog";
import { DEMO_MODE } from "@/lib/demo/mode";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Language } from "@/lib/i18n/translate";
import styles from "./AppShell.module.css";

const PAGES = [
  { path: "/", title: "nav.matrix" },
  { path: "/catalog", title: "nav.catalog" },
  { path: "/expiry", title: "nav.expiry" },
  { path: "/history", title: "nav.history" },
] as const;

const LANGUAGES: Language[] = ["en", "de"];

// The answer of /api/health, or null while it is loading.
function useHealth(): { ok: boolean; companyName?: string } | null {
  const [health, setHealth] = useState<{ ok: boolean; companyName?: string } | null>(null);

  useEffect(() => {
    if (DEMO_MODE) return;
    fetch("/api/health")
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
  }, []);

  return health;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const health = useHealth();
  const { language, setLanguage, t } = useI18n();
  const [helpOpen, setHelpOpen] = useState(false);

  // SAP recommends the compact size for a mouse and the larger one for touch.
  useEffect(() => {
    document.body.toggleAttribute("data-ui5-compact-size", window.matchMedia("(pointer: fine)").matches);
  }, []);

  let connection = "";
  if (DEMO_MODE) connection = t("shell.demoData");
  else if (health) connection = health.ok ? `SAP FSM: ${health.companyName}` : t("shell.notConnected");

  return (
    <>
      <title>{t("app.title")}</title>
      <ShellBar
        primaryTitle={t("app.title")}
        secondaryTitle={connection}
        logo={<Icon name="wrench" design="Information" className={styles.logo} />}
        assistant={
          <SegmentedButton
            accessibleName={t("shell.language")}
            onSelectionChange={(event) => setLanguage(event.detail.selectedItems[0].dataset.language as Language)}
          >
            {LANGUAGES.map((code) => (
              <SegmentedButtonItem key={code} data-language={code} selected={code === language}>
                {code.toUpperCase()}
              </SegmentedButtonItem>
            ))}
          </SegmentedButton>
        }
      >
        <ShellBarItem icon="sys-help" text={t("shell.help")} onClick={() => setHelpOpen(true)} />
      </ShellBar>
      <TabContainer collapsed onTabSelect={(event) => router.push(event.detail.tab.dataset.path ?? "/")}>
        {PAGES.map((page) => (
          <Tab key={page.path} text={t(page.title)} data-path={page.path} selected={pathname === page.path} />
        ))}
      </TabContainer>
      <main className={styles.main}>
        {DEMO_MODE && (
          <MessageStrip design="Information" hideCloseButton>
            {t("shell.demoBanner")}
          </MessageStrip>
        )}
        {children}
      </main>
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      <footer className={styles.footer}>{t("shell.namespace", { id: CANDIDATE_ID })}</footer>
    </>
  );
}
