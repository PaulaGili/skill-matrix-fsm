"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon, ShellBar, ShellBarItem, Tab, TabContainer } from "@ui5/webcomponents-react";
import { CANDIDATE_ID } from "@/lib/candidate";
import { HelpDialog } from "./HelpDialog";
import styles from "./AppShell.module.css";

const PAGES = [
  { path: "/", title: "Skill matrix" },
  { path: "/catalog", title: "Skill catalogue" },
  { path: "/expiry", title: "Expiring" },
];

function useConnection(): string {
  const [connection, setConnection] = useState("");

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((health) => setConnection(health.ok ? `SAP FSM: ${health.companyName}` : "SAP FSM not connected"))
      .catch(() => setConnection("SAP FSM not connected"));
  }, []);

  return connection;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const connection = useConnection();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <ShellBar primaryTitle="Skill Management" secondaryTitle={connection} logo={<Icon name="wrench" design="Information" className={styles.logo} />}>
        <ShellBarItem icon="sys-help" text="Help" onClick={() => setHelpOpen(true)} />
      </ShellBar>
      <TabContainer collapsed onTabSelect={(event) => router.push(event.detail.tab.dataset.path ?? "/")}>
        {PAGES.map((page) => (
          <Tab key={page.path} text={page.title} data-path={page.path} selected={pathname === page.path} />
        ))}
      </TabContainer>
      <main className={styles.main}>{children}</main>
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      <footer className={styles.footer}>SAP FSM namespace: {CANDIDATE_ID}</footer>
    </>
  );
}
