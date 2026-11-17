// Shared setup for the FSM scripts. They call FSM through the running app's proxy, so the
// proxy's write rules apply to them too. Start the app with `npm run dev` first.
import { readFileSync } from "node:fs";
import { setProxyBaseUrl } from "@/lib/fsm/client";
import { CANDIDATE_ID, CANDIDATE_ID_VALID } from "@/lib/candidate";
import type { CertificateUpload } from "@/lib/fsm/services/certificates";

const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function connectToProxy(): Promise<void> {
  if (!CANDIDATE_ID_VALID) throw new Error("NEXT_PUBLIC_CANDIDATE_ID is missing or invalid in .env.local.");
  setProxyBaseUrl(`${APP_URL}/api/fsm`);
  const health = await fetch(`${APP_URL}/api/health`).catch(() => null);
  if (!health?.ok) throw new Error(`The app is not reachable at ${APP_URL}. Run "npm run dev" first.`);
  console.log(`Using ${APP_URL}/api/fsm as "${CANDIDATE_ID}"`);
}

export function sampleCertificate(fileName: string): CertificateUpload {
  const file = readFileSync("tests/fixtures/sample-certificate.pdf");
  return { fileName, sizeBytes: file.length, base64: file.toString("base64") };
}

export function run(main: () => Promise<void>): void {
  main().catch((error) => {
    console.error(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
