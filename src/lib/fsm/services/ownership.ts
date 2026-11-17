// The proxy limits which entities can be written. These checks make sure we only write
// objects in our own namespace of the shared company.
import { NAME_PREFIX, isOwnName } from "@/lib/candidate";

export class OwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnershipError";
  }
}

export function assertOwnName(name: string | null | undefined, what: string): void {
  if (!name || !isOwnName(name)) {
    throw new OwnershipError(`Refusing to change ${what} "${name ?? "?"}": it is not in the ${NAME_PREFIX} namespace.`);
  }
}
