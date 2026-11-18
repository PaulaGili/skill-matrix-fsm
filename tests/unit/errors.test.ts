import { describe, expect, it } from "vitest";
import { FsmError } from "@/lib/fsm/client";
import { toUserMessage } from "@/lib/fsm/errors";
import { ConflictError } from "@/lib/fsm/services/assignments";
import { UserError, translator } from "@/lib/i18n/translate";

const en = translator("en");
const de = translator("de");

describe("toUserMessage", () => {
  it("shows the FSM status and message", () => {
    expect(toUserMessage(new FsmError("CA-118: There is no such field", 400), en)).toBe("FSM error (400): CA-118: There is no such field");
    expect(toUserMessage(new FsmError("CA-118: There is no such field", 400), de)).toBe("FSM-Fehler (400): CA-118: There is no such field");
  });

  it("explains a concurrent change", () => {
    expect(toUserMessage(new FsmError("CA-27: Resource concurrent modification detected", 409), en)).toMatch(/Someone else changed/);
  });

  it("explains a file that the hosting platform cut off", () => {
    expect(toUserMessage(new FsmError("Request Entity Too Large", 413), en)).toMatch(/too large for this server/);
  });

  it("explains a failed network request", () => {
    expect(toUserMessage(new TypeError("Failed to fetch"), en)).toMatch(/not reachable/);
    expect(toUserMessage(new TypeError("Failed to fetch"), de)).toMatch(/nicht erreichbar/);
  });

  it("does not blame the network for other type errors", () => {
    expect(toUserMessage(new TypeError("x is not a function"), en)).toBe("x is not a function");
  });

  it("translates the errors of the rules and services", () => {
    const error = new UserError({ key: "error.tooManyPersons", params: { max: 20 } });
    expect(error.message).toBe("At most 20 persons can be assigned at once.");
    expect(toUserMessage(error, en)).toBe("At most 20 persons can be assigned at once.");
    expect(toUserMessage(error, de)).toBe("Es können höchstens 20 Personen gleichzeitig zugewiesen werden.");
    expect(toUserMessage(new ConflictError(), de)).toMatch(/Jemand anderes hat diese Zuweisung/);
  });

  it("passes on other messages and has a fallback", () => {
    expect(toUserMessage(new Error("Name is required."), en)).toBe("Name is required.");
    expect(toUserMessage("oops", en)).toBe("Something went wrong.");
    expect(toUserMessage("oops", de)).toBe("Etwas ist schiefgelaufen.");
  });
});
