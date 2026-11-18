"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Icon,
  MessageStrip,
  SegmentedButton,
  SegmentedButtonItem,
  ShellBar,
  ShellBarBranding,
  ShellBarItem,
  Tab,
  TabContainer,
} from "@ui5/webcomponents-react";
import { HelpDialog } from "./HelpDialog";
import { DEMO_MODE } from "@/lib/demo/mode";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Language } from "@/lib/i18n/translate";
import styles from "./AppShell.module.css";

const PAGES = [
  { path: "/", title: "nav.matrix" },
  { path: "/catalog", title: "nav.catalog" },
  { path: "/expiry", title: "nav.expiry" },
  { path: "/me", title: "nav.me" },
  { path: "/history", title: "nav.history" },
] as const;

const LANGUAGES: Language[] = ["en", "de"];
const COMPACT_KEY = "view:compact";

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

  // The larger size is the default, as it is easier to read and to hit. The compact size
  // shows more rows and is remembered in this browser for those who choose it.
  useEffect(() => {
    try {
      document.body.toggleAttribute("data-ui5-compact-size", localStorage.getItem(COMPACT_KEY) === "1");
    } catch {}
  }, []);

  function toggleSize() {
    const compact = document.body.toggleAttribute("data-ui5-compact-size");
    try {
      localStorage.setItem(COMPACT_KEY, compact ? "1" : "0");
    } catch {}
  }

  // The bar names the connection only when it is not the normal one. The help names the company.
  let connection = "";
  if (DEMO_MODE) connection = t("shell.demoData");
  else if (health && !health.ok) connection = t("shell.notConnected");

  return (
    <>
      <title>{t("app.title")}</title>
      <ShellBar
        // The name of the app leads home, to the matrix, as the shell bar of a Fiori app does.
        branding={
          <ShellBarBranding
            logo={<Icon name="wrench" design="Information" className={styles.logo} />}
            href="/"
            onClick={(event) => {
              event.preventDefault();
              router.push("/");
            }}
          >
            {t("app.title")}
          </ShellBarBranding>
        }
        secondaryTitle={connection}
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
        <ShellBarItem icon="resize" text={t("shell.size")} onClick={toggleSize} />
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
      {helpOpen && <HelpDialog company={health?.ok ? health.companyName : undefined} onClose={() => setHelpOpen(false)} />}
    </>
  );
}
