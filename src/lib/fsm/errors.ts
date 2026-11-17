import { FsmError } from "./client";

export function toUserMessage(error: unknown): string {
  if (error instanceof FsmError) {
    if (error.status === 409) return "Someone else changed this record in the meantime. Reload and try again.";
    return `FSM error (${error.status}): ${error.message}`;
  }
  // fetch() throws a TypeError when the request never reached the server.
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) return "FSM is not reachable. Check your connection and try again.";
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
