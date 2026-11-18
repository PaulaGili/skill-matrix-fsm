import { describe, expect, it } from "vitest";
import { checkFacts } from "@/lib/domain/certificate-facts";

const TODAY = "2026-11-17";
const facts = { holderName: "Marco Bieri", validFrom: "2026-01-01", validTo: "2027-12-31" };

describe("checkFacts", () => {
  it("passes clean facts through without notes", () => {
    expect(checkFacts(facts, "Bieri, Marco", TODAY)).toEqual({ validFrom: "2026-01-01", validTo: "2027-12-31", notes: [] });
  });

  it("drops values that are not real dates", () => {
    const result = checkFacts({ ...facts, validFrom: "01.01.2026", validTo: "2027-02-30" }, "Bieri, Marco", TODAY);
    expect(result.validFrom).toBeNull();
    expect(result.validTo).toBeNull();
    expect(result.notes).toEqual(["No validity dates were found."]);
  });

  it("drops both dates when they are not in order", () => {
    const result = checkFacts({ ...facts, validFrom: "2027-01-01", validTo: "2026-01-01" }, "Bieri, Marco", TODAY);
    expect(result.validFrom).toBeNull();
    expect(result.validTo).toBeNull();
    expect(result.notes[0]).toContain("not in order");
  });

  it("warns about a certificate that has already expired", () => {
    expect(checkFacts({ ...facts, validTo: "2026-10-31" }, "Bieri, Marco", TODAY).notes).toEqual(["This certificate expired on 31.10.2026."]);
  });

  it("warns when the holder is someone else", () => {
    expect(checkFacts({ ...facts, holderName: "Eva Graf" }, "Bieri, Marco", TODAY).notes).toEqual([
      'The certificate is issued to "Eva Graf", not to Bieri, Marco.',
    ]);
  });

  it("accepts the holder name in another order, case or with accents", () => {
    expect(checkFacts({ ...facts, holderName: "BIERI Marco Andreas" }, "Bieri, Marco", TODAY).notes).toEqual([]);
    expect(checkFacts({ ...facts, holderName: "Sarah Muller" }, "Müller, Sarah", TODAY).notes).toEqual([]);
  });

  it("asks for a check when no holder name was found", () => {
    expect(checkFacts({ ...facts, holderName: null }, "Bieri, Marco", TODAY).notes[0]).toContain("No holder name");
  });
});
