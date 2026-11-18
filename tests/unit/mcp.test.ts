import { describe, expect, it } from "vitest";
import { expiring, listSkills, skillsOfPerson, whoHolds } from "../../mcp/answers";
import type { MatrixData } from "@/lib/fsm/services/matrix";

const TODAY = "2026-11-17";
const person = (id: string, displayName: string, isTechnician = true) => ({ id, displayName, jobTitle: null, isTechnician });
const skill = (id: string, name: string) => ({ id, fsmName: `tester::${name}`, name, description: null, scaleId: "S" });
const assignment = (id: string, personId: string, skillId: string, endDate: string | null) => ({
  id,
  personId,
  skillId,
  startDate: "2026-01-01",
  endDate,
  levelId: "L1",
  levelName: "Basic",
  level: 1,
});

const data: MatrixData = {
  persons: [person("p1", "Aerni, Anna"), person("p2", "Baumann, Beat"), person("p1u", "Aerni, Anna", false)],
  skills: [skill("s1", "Welding"), skill("s2", "First Aid")],
  assignments: [
    assignment("a1", "p1", "s1", null),
    assignment("a2", "p2", "s1", "2026-11-27"),
    assignment("a3", "p2", "s2", "2026-10-01"),
    assignment("a4", "p1u", "s2", null),
  ],
  certificates: [{ id: "c1", assignmentId: "a1", fileName: "a.pdf", type: "PDF", createdAt: null }],
};

describe("MCP answers", () => {
  it("lists the skills with how many technicians hold them today", () => {
    expect(listSkills(data, TODAY)).toEqual([
      { skill: "Welding", description: null, heldToday: 2 },
      { skill: "First Aid", description: null, heldToday: 0 },
    ]);
  });

  it("answers who holds a skill with status and certificate, technicians only", () => {
    expect(whoHolds(data, TODAY, "welding")).toEqual([
      { person: "Aerni, Anna", skill: "Welding", status: "valid", level: "Basic", validFrom: "2026-01-01", validTo: null, hasCertificate: true },
      { person: "Baumann, Beat", skill: "Welding", status: "expiring", level: "Basic", validFrom: "2026-01-01", validTo: "2026-11-27", hasCertificate: false },
    ]);
    expect(whoHolds(data, TODAY, "First Aid")).toHaveLength(1);
  });

  it("names the existing skills when asked for one that does not exist", () => {
    expect(whoHolds(data, TODAY, "Diving")).toEqual({ error: 'There is no skill called "Diving".', skills: ["Welding", "First Aid"] });
  });

  it("finds a person by part of the name", () => {
    expect(skillsOfPerson(data, TODAY, "beat")).toHaveLength(2);
    expect(skillsOfPerson(data, TODAY, "nobody")).toEqual({ error: 'No technician matches "nobody".' });
  });

  it("lists what ends within the window, soonest first", () => {
    expect(expiring(data, TODAY, 30)).toEqual([expect.objectContaining({ person: "Baumann, Beat", skill: "Welding", daysLeft: 10 })]);
    expect(expiring(data, TODAY, 5)).toEqual([]);
  });
});
