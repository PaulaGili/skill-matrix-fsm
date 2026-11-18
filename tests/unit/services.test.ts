import { describe, expect, it } from "vitest";
import { MAX_BULK_ASSIGNMENTS, createAssignments, toAssignment } from "@/lib/fsm/services/assignments";
import { toCertificates } from "@/lib/fsm/services/certificates";
import { OwnershipError, assertOwnName } from "@/lib/fsm/services/ownership";
import { dedupeById, toPerson } from "@/lib/fsm/services/persons";
import { skillNameError, toSkill } from "@/lib/fsm/services/skills";

// The FSM objects below are shortened copies of real responses.

describe("assertOwnName", () => {
  it("accepts names in our namespace", () => {
    expect(() => assertOwnName("tester::Welding", "skill")).not.toThrow();
  });

  it("refuses demo data and other candidates", () => {
    expect(() => assertOwnName("Welding", "skill")).toThrow(OwnershipError);
    expect(() => assertOwnName("jdoe::Welding", "skill")).toThrow(OwnershipError);
    expect(() => assertOwnName(null, "skill")).toThrow(OwnershipError);
  });
});

describe("skillNameError", () => {
  it("requires a name without the namespace separator", () => {
    expect(skillNameError("  Welding ")).toBeNull();
    expect(skillNameError("   ")).toMatch(/required/);
    expect(skillNameError("a::b")).toMatch(/::/);
    expect(skillNameError("x".repeat(600))).toMatch(/too long/);
  });
});

describe("dedupeById", () => {
  it("keeps the first row for each id", () => {
    const rows = [
      { id: "1", value: "a" },
      { id: "2", value: "b" },
      { id: "1", value: "c" },
    ];
    expect(dedupeById(rows)).toEqual([rows[0], rows[1]]);
  });
});

describe("toPerson", () => {
  it("shows the name as Last, First", () => {
    const person = toPerson({ id: "33AEF7DB", firstName: "Marco", lastName: "Bieri", jobTitle: "Service Technician", type: "EMPLOYEE" });
    expect(person).toEqual({ id: "33AEF7DB", displayName: "Bieri, Marco", jobTitle: "Service Technician", isTechnician: true });
  });

  it("does not treat system users or nameless persons as technicians", () => {
    expect(toPerson({ id: "7710708A", firstName: "Marco", lastName: "Bieri", type: "ERPUSER" }).isTechnician).toBe(false);
    const nameless = toPerson({ id: "D74C20AA", firstName: null, lastName: null, type: "EMPLOYEE" });
    expect(nameless.displayName).toBe("(no name) D74C20");
    expect(nameless.isTechnician).toBe(false);
  });
});

describe("toSkill", () => {
  it("strips the prefix and the blank description", () => {
    const skill = toSkill({ id: "T1", name: "tester::Welding", description: " ", scaleId: "S1" });
    expect(skill).toEqual({ id: "T1", fsmName: "tester::Welding", name: "Welding", description: null, scaleId: "S1" });
  });
});

describe("toAssignment", () => {
  it("reads the open end date 9999-12-31 as no end date", () => {
    const assignment = toAssignment({
      id: "0A020C9F",
      tagId: "DF44C767",
      tagName: "tester::Welding",
      technicianId: "33AEF7DB",
      startDate: "2026-01-01",
      endDate: "9999-12-31",
      proficiencyId: "D4BAE41F",
      proficiencyName: "Expert",
      proficiencyLevel: 3,
    });
    expect(assignment).toEqual({
      id: "0A020C9F",
      skillId: "DF44C767",
      personId: "33AEF7DB",
      startDate: "2026-01-01",
      endDate: null,
      levelId: "D4BAE41F",
      levelName: "Expert",
      level: 3,
    });
  });
});

describe("toCertificates", () => {
  it("reads the flat object.objectId field and drops duplicate rows", () => {
    const row = { a: { id: "1E69", fileName: "probe.pdf", type: "PDF", createDateTime: "2026-11-16T16:20:16Z", "object.objectId": "0A020C9F" } };
    expect(toCertificates([row, row])).toEqual([
      { id: "1E69", assignmentId: "0A020C9F", fileName: "probe.pdf", type: "PDF", createdAt: "2026-11-16T16:20:16Z" },
    ]);
  });
});

describe("createAssignments", () => {
  const input = { personId: "P1", levelId: null, startDate: null, endDate: null };

  it("refuses more persons than the limit before anything is sent", async () => {
    const tooMany = Array.from({ length: MAX_BULK_ASSIGNMENTS + 1 }, (_, index) => ({ ...input, personId: `P${index}` }));
    await expect(createAssignments("T1", tooMany)).rejects.toThrow("At most 20 persons");
  });

  it("refuses dates in the wrong order for any person before anything is sent", async () => {
    const wrong = { ...input, personId: "P2", startDate: "2026-02-01", endDate: "2026-01-01" };
    await expect(createAssignments("T1", [input, wrong])).rejects.toThrow("Valid to must not be before");
  });
});
