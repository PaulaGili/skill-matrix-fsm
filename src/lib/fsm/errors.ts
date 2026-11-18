import { DEMO_MODE } from "@/lib/demo/mode";
import { UserError, type Translate } from "@/lib/i18n/translate";
import { FsmError } from "./client";

// The text shown for a failed action, in the language of `t`. Texts that FSM or a server
// route wrote are passed on as they are.
export function toUserMessage(error: unknown, t: Translate): string {
  if (error instanceof UserError) return t(error.key, error.params);
  if (error instanceof FsmError) {
    if (error.status === 409) return t("error.conflict");
    if (DEMO_MODE && error.status === 403) return t("error.demoReadOnly");
    return t("error.fsm", { status: error.status, message: error.message });
  }
  // fetch() throws a TypeError when the request never reached the server.
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) return t("error.unreachable");
  if (error instanceof Error) return error.message;
  return t("error.unknown");
}
