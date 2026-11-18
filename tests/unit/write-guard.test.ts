import { describe, expect, it } from "vitest";
import { isRead, writeRefusal, type OwnData } from "@/lib/fsm/write-guard";

// What FSM holds in our namespace ("tester"). Everything else belongs to someone else.
const own: OwnData = {
  tagIds: async () => new Set(["T1"]),
  skillIds: async () => new Set(["A1"]),
  attachmentIds: async () => new Set(["C1"]),
  scaleIds: async () => new Set(["S1"]),
};
const check = (method: string, path: string, body: unknown = null) => writeRefusal(method, path.split("/"), body, own);
// A certificate as the app uploads it, on our assignment A1.
const upload = (changes: object = {}) => ({
  fileName: "a.pdf",
  type: "PDF",
  fileContent: "JVBERi0=",
  object: { objectId: "A1", objectType: "SKILL" },
  ...changes,
});

describe("isRead", () => {
  it("lets the reads pass, also those sent as POST", () => {
    expect(isRead("GET", ["data", "v4", "Attachment", "C9", "content"])).toBe(true);
    expect(isRead("POST", ["query", "v1"])).toBe(true);
    expect(isRead("POST", ["skill", "v1", "tags", "search"])).toBe(true);
    expect(isRead("POST", ["skill", "v2", "tags"])).toBe(false);
    expect(isRead("DELETE", ["skill", "v2", "tags", "search"])).toBe(false);
  });
});

describe("writeRefusal", () => {
  it("accepts every write the app makes on its own data", async () => {
    expect(await check("POST", "skill/v2/tags", [{ name: "tester::Welding", scaleId: "S1" }])).toBeNull();
    expect(await check("POST", "skill/v2/tags", [{ id: "T1", name: "tester::Welding II" }])).toBeNull();
    expect(await check("DELETE", "skill/v2/tags", [{ id: "T1" }])).toBeNull();
    expect(await check("POST", "skill/v2/skills", [{ tagId: "T1", technician: "P1", startDate: "2026-01-01" }])).toBeNull();
    expect(await check("POST", "skill/v2/skills", [{ id: "A1", tagId: "T1", technician: "P1" }])).toBeNull();
    expect(await check("DELETE", "skill/v2/skills", [{ id: "A1" }])).toBeNull();
    expect(await check("PATCH", "skill/v1/tags/T1/skills/A1", { proficiencyId: null })).toBeNull();
    expect(await check("POST", "skill/v1/scales", { name: "tester::Levels", proficiencies: [] })).toBeNull();
    expect(await check("DELETE", "skill/v2/scales", { id: "S1" })).toBeNull();
    expect(await check("POST", "data/v4/Attachment", upload())).toBeNull();
    expect(await check("DELETE", "data/v4/Attachment/C1")).toBeNull();
  });

  it("refuses a tag or a scale outside our namespace", async () => {
    expect(await check("POST", "skill/v2/tags", [{ name: "Welding" }])).toMatch(/outside the namespace/);
    expect(await check("POST", "skill/v2/tags", [{ name: "other::Welding" }])).toMatch(/outside the namespace/);
    // One good item does not carry a bad one through.
    expect(await check("POST", "skill/v2/tags", [{ name: "tester::A" }, { name: "other::B" }])).toMatch(/outside the namespace/);
    // Our prefix on someone else's tag would take it over.
    expect(await check("POST", "skill/v2/tags", [{ id: "T9", name: "tester::Stolen" }])).toMatch(/outside the namespace/);
    expect(await check("DELETE", "skill/v2/tags", [{ id: "T9" }])).toMatch(/outside the namespace/);
    expect(await check("POST", "skill/v1/scales", { name: "other::Levels" })).toMatch(/outside the namespace/);
    expect(await check("DELETE", "skill/v2/scales", { id: "S9" })).toMatch(/outside the namespace/);
  });

  it("refuses an assignment on someone else's tag, and someone else's assignment", async () => {
    expect(await check("POST", "skill/v2/skills", [{ tagId: "T9", technician: "P1" }])).toMatch(/outside the namespace/);
    expect(await check("POST", "skill/v2/skills", [{ id: "A9", tagId: "T1", technician: "P1" }])).toMatch(/outside the namespace/);
    expect(await check("DELETE", "skill/v2/skills", [{ id: "A1" }, { id: "A9" }])).toMatch(/outside the namespace/);
    expect(await check("PATCH", "skill/v1/tags/T9/skills/A1", {})).toMatch(/outside the namespace/);
    expect(await check("PATCH", "skill/v1/tags/T1/skills/A9", {})).toMatch(/outside the namespace/);
  });

  it("refuses a certificate on or of someone else's assignment", async () => {
    expect(await check("POST", "data/v4/Attachment", { object: { objectId: "A9", objectType: "SKILL" } })).toMatch(/outside the namespace/);
    expect(await check("POST", "data/v4/Attachment", { object: { objectId: "A1", objectType: "PERSON" } })).toMatch(/outside the namespace/);
    expect(await check("POST", "data/v4/Attachment", { fileName: "a.pdf" })).toMatch(/outside the namespace/);
    expect(await check("DELETE", "data/v4/Attachment/C9")).toMatch(/outside the namespace/);
  });

  it("refuses a file that is no certificate, also on our own assignment", async () => {
    const refused = /PDF, JPG or PNG/;
    expect(await check("POST", "data/v4/Attachment", upload({ fileName: "a.jpg", type: "JPEG" }))).toBeNull();
    expect(await check("POST", "data/v4/Attachment", upload({ fileName: "a.exe" }))).toMatch(refused);
    expect(await check("POST", "data/v4/Attachment", upload({ fileName: "a.pdf", type: "HTML" }))).toMatch(refused);
    expect(await check("POST", "data/v4/Attachment", upload({ fileContent: "" }))).toMatch(refused);
    expect(await check("POST", "data/v4/Attachment", upload({ fileContent: undefined }))).toMatch(refused);
    // 5 MB pass, one byte more does not.
    const base64 = (bytes: number) => "A".repeat(Math.ceil((bytes * 4) / 3));
    expect(await check("POST", "data/v4/Attachment", upload({ fileContent: base64(5 * 1024 * 1024) }))).toBeNull();
    expect(await check("POST", "data/v4/Attachment", upload({ fileContent: base64(5 * 1024 * 1024 + 3) }))).toMatch(refused);
  });

  it("refuses every write the app does not make, and a body it cannot read", async () => {
    expect(await check("POST", "data/v4/Tag", { name: "tester::Welding" })).toMatch(/not a write this app makes/);
    expect(await check("PATCH", "data/v4/Skill/A1", {})).toMatch(/not a write this app makes/);
    expect(await check("PUT", "skill/v2/tags", [{ id: "T1" }])).toMatch(/not a write this app makes/);
    expect(await check("POST", "skill/v1/scales/S1/proficiencies", { name: "x" })).toMatch(/not a write this app makes/);
    expect(await check("POST", "skill/v2/tags", null)).toMatch(/not a write this app makes/);
    expect(await check("POST", "skill/v2/tags", [])).toMatch(/not a write this app makes/);
    expect(await check("DELETE", "skill/v2/skills", [{ id: 7 }])).toMatch(/outside the namespace/);
  });
});
