import { describe, expect, it } from "vitest";
import { FsmError } from "@/lib/fsm/client";
import { toUserMessage } from "@/lib/fsm/errors";

describe("toUserMessage", () => {
  it("shows the FSM status and message", () => {
    expect(toUserMessage(new FsmError("CA-118: There is no such field", 400))).toBe("FSM error (400): CA-118: There is no such field");
  });

  it("explains a concurrent change", () => {
    expect(toUserMessage(new FsmError("CA-27: Resource concurrent modification detected", 409))).toMatch(/Someone else changed/);
  });

  it("explains a failed network request", () => {
    expect(toUserMessage(new TypeError("Failed to fetch"))).toMatch(/not reachable/);
  });

  it("does not blame the network for other type errors", () => {
    expect(toUserMessage(new TypeError("x is not a function"))).toBe("x is not a function");
  });

  it("passes on validation messages and has a fallback", () => {
    expect(toUserMessage(new Error("Name is required."))).toBe("Name is required.");
    expect(toUserMessage("oops")).toBe("Something went wrong.");
  });
});
