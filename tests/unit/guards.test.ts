import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, createAssignments, endAssignments, requireOwnAssignments, updateAssignment } from "@/lib/fsm/services/assignments";
import { deleteCertificates } from "@/lib/fsm/services/certificates";
import { OwnershipError } from "@/lib/fsm/services/ownership";
import { removeAssignments } from "@/lib/fsm/services/remove";
import { saveAssignment } from "@/lib/fsm/services/save-assignment";
import { createSkill, listSkills, requireOwnSkill } from "@/lib/fsm/services/skills";
import { undoChange } from "@/lib/history/undo";

// A small FSM with our data (namespace "tester") and another candidate's. The tests check
// which requests the services send, so that nothing foreign is ever written.
const TAGS = [
  { id: "T1", name: "tester::Welding", scaleId: "S1" },
  { id: "T9", name: "other::Welding", scaleId: "S9" },
];
const skill = (id: string, tagId: string, tagName: string) => ({
  id,
  tagId,
  tagName,
  technicianId: "P1",
  startDate: "2026-01-01",
  endDate: "9999-12-31",
  proficiencyId: null,
});
const SKILLS = [skill("A1", "T1", "tester::Welding"), skill("A9", "T9", "other::Welding")];
const ATTACHMENTS = [{ a: { id: "C1", fileName: "a.pdf", type: "PDF", "object.objectId": "A1" } }];

let writes: string[] = [];
let bodies: unknown[] = [];

beforeEach(() => {
  writes = [];
  bodies = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const path = url.replace("/api/fsm/", "").split("?")[0];
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (path === "skill/v1/tags/search") return json({ content: TAGS, last: true });
    if (path === "skill/v1/skills/search") return json({ content: SKILLS, last: true });
    if (path === "query/v1") return json({ data: ATTACHMENTS, lastPage: 1 });
    writes.push(`${init.method} ${path}`);
    const body: unknown = init.body ? JSON.parse(String(init.body)) : null;
    bodies.push(body);
    // A bulk route answers with what it was sent, plus an id.
    const results = Array.isArray(body) ? body.map((item) => ({ status: 200, resource: { id: "NEW", ...item } })) : [];
    return json({ hasErrors: false, results });
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

  it("clears the level by person, whatever the order of the answer", async () => {
    const patched: string[] = [];
    const created = (id: string, technicianId: string) => ({ ...skill(id, "T1", "tester::Welding"), technicianId, proficiencyId: "L1" });
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
      if (url.includes("tags/search")) return json({ content: TAGS, last: true });
      if (url.includes("skills/search")) return json({ content: [], last: true });
      if (init.method === "PATCH") patched.push(url.split("/").pop()!);
      // FSM answers in the opposite order: P3 first, then P2.
      return json({
        hasErrors: false,
        results: [
          { status: 201, resource: created("A3", "P3") },
          { status: 201, resource: created("A2", "P2") },
        ],
      });
    });
    const result = await createAssignments([
      { skillId: "T1", personId: "P2", levelId: null, startDate: null, endDate: null },
      { skillId: "T1", personId: "P3", levelId: "L1", startDate: null, endDate: null },
    ]);
    expect(patched).toEqual(["A2"]);
    expect(result.map((a) => [a.personId, a.levelId])).toEqual([
      ["P3", "L1"],
      ["P2", null],
    ]);
  });

  it("does not create a second assignment for a person who has the skill", async () => {
    await expect(createAssignments([{ skillId: "T1", personId: "P1", levelId: null, startDate: null, endDate: null }])).rejects.toThrow("already has");
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

describe("undoChange for a new assignment", () => {
  const assigned = (assignmentId: string, startDate: string) => ({
    id: "c1",
    at: "2026-11-17T10:00:00Z",
    kind: "assigned" as const,
    skillId: "T1",
    skillName: "Welding",
    personId: "P1",
    personName: "Aerni, Anna",
    assignmentId,
    before: null,
    after: { levelId: null, levelName: null, startDate, endDate: null },
    lostCertificates: 0,
    undone: false,
  });

  it("keeps an assignment that has a certificate by now", async () => {
    await expect(undoChange(assigned("A1", "2026-01-01"))).rejects.toThrow("has a certificate");
    expect(writes).toEqual([]);
  });

  it("keeps an assignment that was changed or removed after it was created", async () => {
    await expect(undoChange(assigned("A1", "2025-06-01"))).rejects.toThrow("changed");
    await expect(undoChange(assigned("A-gone", "2026-01-01"))).rejects.toThrow("changed");
    expect(writes).toEqual([]);
  });
});

describe("skills in our namespace", () => {
  it("lists only our skills and creates a skill with our prefix", async () => {
    expect((await listSkills()).map((s) => s.name)).toEqual(["Welding"]);
    await createSkill({ name: " Crane ", scaleId: "S1" });
    expect(bodies).toEqual([[{ name: "tester::Crane", scaleId: "S1" }]]);
  });
});

describe("updateAssignment", () => {
  const loaded = { id: "A1", skillId: "T1", personId: "P1", level: null, levelName: null, levelId: null, startDate: "2026-01-01", endDate: null };

  it("refuses to write when FSM holds other values than the user saw", async () => {
    const stale = { ...loaded, startDate: "2025-06-01" };
    await expect(updateAssignment("T1", stale, { levelId: null, startDate: "2025-06-01", endDate: "2027-01-01" })).rejects.toThrow(ConflictError);
    expect(writes).toEqual([]);
  });

  it("sends the validity type with the end date, or FSM ignores the date", async () => {
    await updateAssignment("T1", loaded, { levelId: null, startDate: "2026-01-01", endDate: "2027-01-01" });
    await updateAssignment("T1", loaded, { levelId: null, startDate: "2026-01-01", endDate: null });
    expect(bodies).toEqual([
      { proficiencyId: null, startDate: "2026-01-01", endDate: "2027-01-01", validityType: "LF" },
      { proficiencyId: null, startDate: "2026-01-01", endDate: "9999-12-31", validityType: "PE" },
    ]);
  });
});

describe("endAssignments", () => {
  it("ends them in one request, each with its id, and never one of another candidate", async () => {
    await endAssignments("T1", ["A1"], () => "2026-11-16");
    expect(writes).toEqual(["POST skill/v2/skills"]);
    // Without the id FSM would create a second skill instead of ending this one.
    expect(bodies[0]).toEqual([{ id: "A1", tagId: "T1", technician: "P1", startDate: "2026-01-01", endDate: "2026-11-16", validityType: "LF" }]);
    await expect(endAssignments("T1", ["A9"], () => "2026-11-16")).rejects.toThrow(OwnershipError);
    expect(writes).toHaveLength(1);
  });
});

describe("saveAssignment", () => {
  const upload = { fileName: "a.pdf", sizeBytes: 10, base64: "AA==" };
  const unchanged = { levelId: null, startDate: "2026-01-01", endDate: null };

  it("uploads nothing to an assignment that is not ours", async () => {
    const foreign = { id: "A9", skillId: "T1", personId: "P1", level: null, levelName: null, ...unchanged };
    await expect(saveAssignment("T1", "P1", foreign, { input: unchanged, deleteCertificateIds: [], uploads: [upload] })).rejects.toThrow(OwnershipError);
    expect(writes).toEqual([]);
  });

  it("touches no certificate when the assignment was changed by someone else", async () => {
    const stale = { id: "A1", skillId: "T1", personId: "P1", level: null, levelName: null, ...unchanged, startDate: "2025-06-01" };
    const input = { ...unchanged, endDate: "2027-01-01" };
    await expect(saveAssignment("T1", "P1", stale, { input, deleteCertificateIds: ["C1"], uploads: [upload] })).rejects.toThrow(ConflictError);
    expect(writes).toEqual([]);
  });

  it("returns the saved assignment when a certificate cannot be deleted", async () => {
    const fetchOk = globalThis.fetch;
    vi.stubGlobal("fetch", (url: string, init: RequestInit = {}) => (init.method === "DELETE" ? Promise.reject(new Error("down")) : fetchOk(url, init)));
    const own = { id: "A1", skillId: "T1", personId: "P1", level: null, levelName: null, ...unchanged };
    const result = await saveAssignment("T1", "P1", own, { input: { ...unchanged, endDate: "2027-01-01" }, deleteCertificateIds: ["C1"], uploads: [] });
    expect(result.saved.endDate).toBe("2027-01-01");
    expect(result.notDeleted).toBeInstanceOf(Error);
  });

  it("uploads to our own assignment after one check", async () => {
    const own = { id: "A1", skillId: "T1", personId: "P1", level: null, levelName: null, ...unchanged };
    await saveAssignment("T1", "P1", own, { input: unchanged, deleteCertificateIds: [], uploads: [upload] });
    expect(writes).toEqual(["POST data/v4/Attachment"]);
  });
});
