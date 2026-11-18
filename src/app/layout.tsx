import type { Metadata } from "next";
import "@ui5/webcomponents-react/styles.css";
import "./globals.css";
import { AppShell } from "@/components/common/AppShell";
import { AppProviders } from "@/components/providers/AppProviders";
import { I18nProvider } from "@/lib/i18n/I18nProvider";

// The tab title is set by AppShell, in the language of the user.
export const metadata: Metadata = {
  description: "opusm assessment: skill matrix and certificates on SAP FSM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* UI5 Web Components runtime configuration. Must exist before any component boots. */}
        <script
          data-ui5-config
          type="application/json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({ theme: "sap_horizon", animationMode: "minimal" }) }}
        />
      </head>
      <body>
        <AppProviders>
          <I18nProvider>
            <AppShell>{children}</AppShell>
          </I18nProvider>
        </AppProviders>
      </body>
    </html>
  );
}
