import { createHash, timingSafeEqual } from "node:crypto";

// Digests have the same length, so they can be compared in constant time.
const digest = (text: string) => createHash("sha256").update(text).digest();

// The optional access code of a hosted copy, sent by the browser as HTTP Basic credentials.
// The user name is ignored, the password is the code. The compare takes the same time for
// every wrong code, so the answer time tells nothing about how much of it was right.
export function accessAllowed(authorization: string | null, code: string | undefined): boolean {
  if (!code) return true;
  if (!authorization?.startsWith("Basic ")) return false;
  const [, ...password] = Buffer.from(authorization.slice(6), "base64").toString("utf8").split(":");
  return timingSafeEqual(digest(password.join(":")), digest(code));
}

// A hosted copy that talks to the real FSM has to ask for a code: the checks that a record is
// ours run in the browser, so without a code anyone with the URL could write to the company.
export function needsAccessCode(env: { hosted: boolean; demo: boolean; code: string | undefined }): boolean {
  return env.hosted && !env.demo && !env.code;
}

// The demo copy shows sample data only. The real FSM proxy and the AI routes stay closed there,
// so a public URL can never write to FSM or spend the AI key.
export function closedInDemo(pathname: string): boolean {
  return pathname.startsWith("/api/fsm") || pathname.startsWith("/api/ai");
}
