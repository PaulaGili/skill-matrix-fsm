import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAssignments, requireOwnAssignments } from "@/lib/fsm/services/assignments";
import { deleteCertificates } from "@/lib/fsm/services/certificates";
import { OwnershipError } from "@/lib/fsm/services/ownership";
import { removeAssignments } from "@/lib/fsm/services/remove";
import { requireOwnSkill } from "@/lib/fsm/services/skills";

// A small FSM with our data (namespace "tester") and another candidate's. The tests check
// which requests the services send, so that nothing foreign is ever written.
const TAGS = [
  { id: "T1", name: "tester::Welding", scaleId: "S1" },
  { id: "T9", name: "other::Welding", scaleId: "S9" },
];
const skill = (id: string, tagId: string, tagName: string) => ({ id, tagId, tagName, technicianId: "P1", startDate: "2026-01-01", endDate: "9999-12-31" });
const SKILLS = [skill("A1", "T1", "tester::Welding"), skill("A9", "T9", "other::Welding")];
const ATTACHMENTS = [{ a: { id: "C1", fileName: "a.pdf", type: "PDF", "object.objectId": "A1" } }];

let writes: string[] = [];

beforeEach(() => {
  writes = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const path = url.replace("/api/fsm/", "").split("?")[0];
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (path === "skill/v1/tags/search") return json({ content: TAGS, last: true });
    if (path === "skill/v1/skills/search") return json({ content: SKILLS, last: true });
    if (path === "query/v1") return json({ data: ATTACHMENTS, lastPage: 1 });
    writes.push(`${init.method} ${path}`);
    return json({ hasErrors: false, results: [] });
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("ownership guards", () => {
  it("refuses a skill of another candidate", async () => {
    await expect(requireOwnSkill("T9")).rejects.toThrow(OwnershipError);
  });

  it("refuses an assignment that does not belong to the given skill", async () => {
    await expect(requireOwnAssignments("T1", ["A9"])).rejects.toThrow(OwnershipError);
  });

  it("deletes only certificates that FSM lists on our skills", async () => {
    await deleteCertificates(["C1", "C-foreign"]);
    expect(writes).toEqual(["DELETE data/v4/Attachment/C1"]);
  });

  it("does not create a second assignment for a person who has the skill", async () => {
    await expect(createAssignments("T1", [{ personId: "P1", levelId: null, startDate: null, endDate: null }])).rejects.toThrow("already has");
    expect(writes).toEqual([]);
  });
});

describe("removeAssignments", () => {
  it("deletes the certificates before the assignment", async () => {
    await removeAssignments("T1", ["A1"]);
    expect(writes).toEqual(["DELETE data/v4/Attachment/C1", "DELETE skill/v2/skills"]);
  });

  it("deletes nothing when the assignment is not ours", async () => {
    await expect(removeAssignments("T1", ["A9"])).rejects.toThrow(OwnershipError);
    expect(writes).toEqual([]);
  });
});
