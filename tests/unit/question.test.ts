import { describe, expect, it } from "vitest";
import { toFilters, type QuestionAnswer } from "@/lib/domain/question";

const SKILLS = [
  { id: "s1", name: "Welding" },
  { id: "s2", name: "First Aid" },
];
const LEVELS = ["Basic", "Advanced", "Expert"];
const answer = (changes: Partial<QuestionAnswer>): QuestionAnswer => ({
  understood: true,
  personSearch: null,
  skills: [],
  statuses: [],
  levels: [],
  unknown: [],
  ...changes,
});

describe("toFilters", () => {
  it("maps skill and level names to what exists, ignoring case", () => {
    const { filters, notFound } = toFilters(answer({ skills: ["welding", "FIRST AID"], levels: ["expert"], statuses: ["expired"] }), SKILLS, LEVELS);
    expect(filters).toEqual({ search: "", skillIds: ["s1", "s2"], statuses: ["expired"], levels: ["Expert"] });
    expect(notFound).toEqual([]);
  });

  it("sets no filters when the question names something that does not exist", () => {
    expect(toFilters(answer({ skills: ["Welding", "Diving"] }), SKILLS, LEVELS)).toEqual({ filters: null, notFound: ["Diving"] });
    expect(toFilters(answer({ statuses: ["valid", "expiring"], unknown: ["Diving"] }), SKILLS, LEVELS)).toEqual({ filters: null, notFound: ["Diving"] });
    expect(toFilters(answer({ skills: ["Welding"], levels: ["Master"] }), SKILLS, LEVELS).notFound).toEqual(["Master"]);
  });

  it("drops statuses that are not filters of the matrix", () => {
    expect(toFilters(answer({ statuses: ["expired", "deleted"] }), SKILLS, LEVELS).filters?.statuses).toEqual(["expired"]);
  });

  it("asks who holds a skill today when a skill comes without a status", () => {
    expect(toFilters(answer({ skills: ["Welding"] }), SKILLS, LEVELS).filters?.statuses).toEqual(["valid", "expiring"]);
  });

  it("accepts statuses or a person search without a skill", () => {
    expect(toFilters(answer({ statuses: ["expiring", "noCertificate"] }), SKILLS, LEVELS).filters?.statuses).toEqual(["expiring", "noCertificate"]);
    expect(toFilters(answer({ personSearch: " Meier " }), SKILLS, LEVELS).filters?.search).toBe("Meier");
  });

  it("sets no filters when the question was not understood or is empty", () => {
    expect(toFilters(answer({ understood: false, skills: ["Welding"] }), SKILLS, LEVELS).filters).toBeNull();
    expect(toFilters(answer({}), SKILLS, LEVELS).filters).toBeNull();
  });
});
