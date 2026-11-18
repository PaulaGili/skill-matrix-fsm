import { describe, expect, it } from "vitest";
import {
  CERTIFICATE_COLUMNS,
  certificateRows,
  columnsFromHeaders,
  guessColumns,
  parseCsv,
  parseDate,
  toImportRows,
  unusedColumns,
  withProposed,
  type ImportContext,
} from "@/lib/domain/import";

describe("guessColumns and columnsFromHeaders", () => {
  it("finds the usual titles in English and German", () => {
    expect(guessColumns(["Person", "Skill", "Level", "Valid from", "Valid to"])).toEqual({ person: 0, skill: 1, level: 2, validFrom: 3, validTo: 4 });
    expect(guessColumns(["Qualifikation", "Mitarbeiter", "Gültig bis"])).toEqual({ person: 1, skill: 0, level: null, validFrom: null, validTo: 2 });
    expect(guessColumns(["Wer", "Was"]).person).toBeNull();
    expect(unusedColumns(["Person", "Skill", "Ablauf", ""], guessColumns(["Person", "Skill", "Ablauf", ""]))).toEqual([2]);
    // The AI saw only the left-over columns 1 and 2. Its answer fills open fields and never moves person.
    const guessed = guessColumns(["Name", "Name", "Was"]);
    const proposed = { person: 0, skill: 1, level: null, validFrom: null, validTo: null };
    expect(withProposed(guessed, proposed, [1, 2])).toMatchObject({ person: 0, skill: 2 });
  });

  it("accepts only headers of the sheet from the AI", () => {
    const answer = { person: "Wer", skill: "Was", level: "Made up", validFrom: null, validTo: "ablauf" };
    expect(columnsFromHeaders(answer, ["Wer", "Was", "Ablauf"])).toEqual({ person: 0, skill: 1, level: null, validFrom: null, validTo: 2 });
    // The same title for two fields is used once.
    expect(columnsFromHeaders({ ...answer, skill: "Wer" }, ["Wer", "Was", "Ablauf"]).skill).toBeNull();
  });
});

describe("parseCsv and parseDate", () => {
  it("reads comma or semicolon files with quoted values", () => {
    expect(parseCsv('Person,Skill\r\n"Bieri, Marco",Welding\r\n')).toEqual([
      ["Person", "Skill"],
      ["Bieri, Marco", "Welding"],
    ]);
    expect(parseCsv('Person;Skill\n"say ""hi""";First Aid')[1]).toEqual(['say "hi"', "First Aid"]);
    // A separator inside quotes does not decide, and a space may come before a quote.
    expect(parseCsv('"Name, Vorname";Qualifikation\n"Bieri, Marco"; "First Aid; basic"')).toEqual([
      ["Name, Vorname", "Qualifikation"],
      ["Bieri, Marco", "First Aid; basic"],
    ]);
    // A line break inside quotes, a quote inside a value and old Mac line ends.
    expect(parseCsv('A;B\r"one\ntwo";5" pipe\r')).toEqual([
      ["A", "B"],
      ["one\ntwo", '5" pipe'],
    ]);
  });

  it("reads Swiss and ISO dates and date cells, and rejects the rest", () => {
    expect(parseDate("31.12.2027")).toBe("2027-12-31");
    expect(parseDate("1.3.2027")).toBe("2027-03-01");
    expect(parseDate("2027-12-31")).toBe("2027-12-31");
    expect(parseDate(new Date("2027-12-31T00:00:00Z"))).toBe("2027-12-31");
    expect(parseDate("")).toBeNull();
    expect(parseDate("next year")).toBe("invalid");
    expect(parseDate("31.02.2027")).toBe("invalid");
  });
});

describe("toImportRows", () => {
  const context: ImportContext = {
    persons: [
      { id: "p1", displayName: "Bieri, Marco", isTechnician: true },
      { id: "p1u", displayName: "Bieri, Marco", isTechnician: false },
      { id: "p2", displayName: "Graf, Eva", isTechnician: true },
      { id: "p3", displayName: "Graf, Eva", isTechnician: true },
    ],
    skills: [{ id: "s1", name: "Welding", scaleId: "S" }],
    levels: { S: [{ id: "L1", name: "Basic" }] },
    isAssigned: (personId, skillId) => personId === "p1" && skillId === "s9",
  };
  const columns = { person: 0, skill: 1, level: 2, validFrom: 3, validTo: 4 };
  const problemOf = (row: unknown[]) => toImportRows([row], columns, context)[0].problem?.key ?? null;

  it("turns a good row into an assignment, whatever the order of the name", () => {
    expect(toImportRows([["Marco Bieri", "welding", "basic", "01.01.2027", "31.12.2027"]], columns, context)[0]).toEqual({
      line: 2,
      personText: "Marco Bieri",
      skillText: "welding",
      personId: "p1",
      skillId: "s1",
      levelId: "L1",
      startDate: "2027-01-01",
      endDate: "2027-12-31",
      problem: null,
    });
  });

  it("says why a row cannot be imported", () => {
    expect(problemOf(["Nobody", "Welding", "", "", ""])).toBe("import.noPerson");
    expect(problemOf(["Eva Graf", "Welding", "", "", ""])).toBe("import.manyPersons");
    expect(problemOf(["Marco Bieri", "Diving", "", "", ""])).toBe("import.noSkill");
    expect(problemOf(["Marco Bieri", "Welding", "Master", "", ""])).toBe("import.noLevel");
    expect(problemOf(["Marco Bieri", "Welding", "", "soon", ""])).toBe("import.badDate");
    expect(problemOf(["Marco Bieri", "Welding", "", "01.02.2027", "01.01.2027"])).toBe("validity.toBeforeFrom");
  });

  it("skips empty rows, keeps the row number of the file and matches no one for an empty name", () => {
    const rows = toImportRows(
      [
        ["", "", "", "", ""],
        ["Marco Bieri", "Welding", "", "", ""],
        ["", "Welding", "", "", ""],
      ],
      columns,
      context,
    );
    expect(rows.map((row) => [row.line, row.problem?.key ?? null])).toEqual([
      [3, null],
      [4, "import.noPerson"],
    ]);
  });

  it("matches a name typed with a separate accent mark", () => {
    const people = { ...context, persons: [{ id: "p9", displayName: "M\u00fcller, Sarah", isTechnician: true }] };
    expect(toImportRows([["Sarah Mu\u0308ller", "Welding", "", "", ""]], columns, people)[0].personId).toBe("p9");
  });

  it("flags the second row for the same person and skill", () => {
    const rows = toImportRows(
      [
        ["Marco Bieri", "Welding"],
        ["Bieri, Marco", "Welding"],
      ],
      { ...columns, level: null, validFrom: null, validTo: null },
      context,
    );
    expect(rows.map((row) => row.problem?.key ?? null)).toEqual([null, "import.twice"]);
  });

  it("checks what was read from certificates like the rows of a file", () => {
    const read = { fileName: "a.pdf", holderName: "Marco Bieri", skill: "Welding", validFrom: "2026-03-01", validTo: "2028-02-28" };
    const rows = toImportRows(
      certificateRows([
        read,
        { ...read, fileName: "b.pdf", holderName: "Lukas Meier" },
        { ...read, fileName: "c.pdf", skill: null },
        { ...read, fileName: "d.pdf", holderName: null, skill: null, validFrom: null, validTo: null },
      ]),
      CERTIFICATE_COLUMNS,
      context,
    );
    expect(rows[0]).toMatchObject({ line: 2, personId: "p1", skillId: "s1", levelId: null, startDate: "2026-03-01", endDate: "2028-02-28", problem: null });
    // A file on which nothing was read keeps its row, so every file is answered for.
    expect(rows.map((row) => row.problem?.key)).toEqual([undefined, "import.noPerson", "import.noSkill", "import.noPerson"]);
  });
});
