import { describe, expect, it } from "vitest";
import { checkFacts, existingSkill } from "@/lib/domain/certificate-facts";

const TODAY = "2026-11-17";
const facts = { holderName: "Marco Bieri", validFrom: "2026-01-01", validTo: "2027-12-31", forSkill: "yes" as const };

describe("checkFacts", () => {
  it("passes clean facts through without notes", () => {
    expect(checkFacts(facts, "Bieri, Marco", TODAY)).toEqual({ validFrom: "2026-01-01", validTo: "2027-12-31", notes: [] });
  });

  it("drops values that are not real dates", () => {
    const result = checkFacts({ ...facts, validFrom: "01.01.2026", validTo: "2027-02-30" }, "Bieri, Marco", TODAY);
    expect(result.validFrom).toBeNull();
    expect(result.validTo).toBeNull();
    expect(result.notes).toEqual([{ key: "facts.noDates" }]);
  });

  it("drops both dates when they are not in order", () => {
    const result = checkFacts({ ...facts, validFrom: "2027-01-01", validTo: "2026-01-01" }, "Bieri, Marco", TODAY);
    expect(result.validFrom).toBeNull();
    expect(result.validTo).toBeNull();
    expect(result.notes[0]).toEqual({ key: "facts.notInOrder" });
  });

  it("warns about a certificate that has already expired", () => {
    expect(checkFacts({ ...facts, validTo: "2026-10-31" }, "Bieri, Marco", TODAY).notes).toEqual([{ key: "facts.expired", params: { date: "31.10.2026" } }]);
  });

  it("warns when the holder is someone else", () => {
    expect(checkFacts({ ...facts, holderName: "Eva Graf" }, "Bieri, Marco", TODAY).notes).toEqual([
      { key: "facts.otherHolder", params: { holder: "Eva Graf", person: "Bieri, Marco" } },
    ]);
  });

  it("accepts the holder name in another order, case or with accents", () => {
    expect(checkFacts({ ...facts, holderName: "BIERI Marco Andreas" }, "Bieri, Marco", TODAY).notes).toEqual([]);
    expect(checkFacts({ ...facts, holderName: "Sarah Muller" }, "Müller, Sarah", TODAY).notes).toEqual([]);
  });

  it("asks for a check when no holder name was found", () => {
    expect(checkFacts({ ...facts, holderName: null }, "Bieri, Marco", TODAY).notes[0]).toEqual({ key: "facts.noHolder" });
  });

  it("warns when the certificate is for another skill", () => {
    const context = { skillName: "Welding" };
    expect(checkFacts({ ...facts, forSkill: "no" }, "Bieri, Marco", TODAY, context).notes).toEqual([{ key: "facts.otherSkill", params: { skill: "Welding" } }]);
    expect(checkFacts({ ...facts, forSkill: "unclear" }, "Bieri, Marco", TODAY, context).notes).toEqual([]);
  });

  it("warns when the stored validity differs from the certificate", () => {
    const notes = (stored: { startDate: string | null; endDate: string | null }) =>
      checkFacts(facts, "Bieri, Marco", TODAY, { skillName: "Welding", stored }).notes;
    expect(notes({ startDate: "2026-01-01", endDate: "2027-12-31" })).toEqual([]);
    expect(notes({ startDate: "2026-01-01", endDate: null })).toEqual([{ key: "facts.toDiffersOpen", params: { certificate: "31.12.2027" } }]);
    expect(notes({ startDate: "2025-06-01", endDate: "2027-12-31" })).toEqual([
      { key: "facts.fromDiffers", params: { certificate: "01.01.2026", assignment: "01.06.2025" } },
    ]);
  });

  it("does not compare a date the certificate does not show", () => {
    const result = checkFacts({ ...facts, validFrom: null }, "Bieri, Marco", TODAY, {
      skillName: "Welding",
      stored: { startDate: "2020-01-01", endDate: "2027-12-31" },
    });
    expect(result.notes).toEqual([]);
  });
});

describe("existingSkill", () => {
  const SKILLS = ["Welding", "First Aid"];

  it("accepts only a name that is in the catalogue", () => {
    expect(existingSkill("welding", SKILLS)).toBe("Welding");
    expect(existingSkill("Diving", SKILLS)).toBeNull();
    expect(existingSkill(null, SKILLS)).toBeNull();
  });
});
