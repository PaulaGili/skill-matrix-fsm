// The proxy limits which entities can be written. These checks make sure we only write
// objects in our own namespace of the shared company.
import { NAME_PREFIX, isOwnName } from "@/lib/candidate";
import { UserError, type Message } from "@/lib/i18n/translate";

export class OwnershipError extends UserError {
  constructor(message: Message) {
    super(message);
    this.name = "OwnershipError";
  }
}

export function assertOwnName(name: string | null | undefined, what: string): void {
  if (!name || !isOwnName(name)) {
    throw new OwnershipError({ key: "error.notOwnName", params: { what, name: name ?? "?", prefix: NAME_PREFIX } });
  }
}
