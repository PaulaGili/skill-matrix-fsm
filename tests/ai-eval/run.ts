// npm run eval:ai [-- runs [certificate model]]: asks the real AI service known cases and
// compares what the app would do with each answer. Needs ANTHROPIC_API_KEY in .env.local.
// The result is written to last-run.txt. See "Evaluating the AI features" in docs/decisions.md.
import { readFileSync, writeFileSync } from "node:fs";
import { matchColumns } from "@/lib/ai/import-columns";
import { questionToAnswer } from "@/lib/ai/question";
import { readCertificate } from "@/lib/ai/read-certificate";
import { MODEL } from "@/lib/ai/server";
import { similarSkill } from "@/lib/ai/similar-skill";
import { checkCertificateFile } from "@/lib/domain/certificate";
import { existingSkill } from "@/lib/domain/certificate-facts";
import { IMPORT_FIELDS, columnsFromHeaders, guessColumns, unusedColumns, withProposed } from "@/lib/domain/import";
import { toFilters } from "@/lib/domain/question";

const RUNS = Number(process.argv[2] ?? 1);
const CERTIFICATE_MODEL = process.argv[3] ?? MODEL;

const SKILLS = [
  { id: "s1", name: "Welding" },
  { id: "s2", name: "First Aid" },
  { id: "s3", name: "Working at Heights" },
  { id: "s4", name: "Electrical Switching" },
  { id: "s5", name: "Gas Engines" },
];
const SKILL_NAMES = SKILLS.map((skill) => skill.name);
const LEVELS = ["Basic", "Advanced", "Expert"];

const lines: string[] = [];
function say(line = "") {
  console.log(line);
  lines.push(line);
}

const load = <Case>(file: string): Case[] => JSON.parse(readFileSync(`tests/ai-eval/${file}`, "utf8"));
const sorted = (values: readonly string[]) => [...values].sort().join(", ");
// One problem line when the two differ, none when they are the same.
const differs = (field: string, expected: string | null, got: string | null) =>
  (expected ?? "").toLowerCase() === (got ?? "").toLowerCase() ? [] : [`${field}: expected ${expected}, got ${got}`];

// Asks every case RUNS times. The same input can get a different answer the next time, so a
// case counts only when no run has a problem. An error of the service is a problem too.
async function score<Case>(title: string, cases: Case[], nameOf: (c: Case) => string, problemsOf: (c: Case) => Promise<string[]>): Promise<boolean> {
  say(`\n${title}`);
  const started = Date.now();
  let correct = 0;
  for (const c of cases) {
    const problems = new Set<string>();
    let passed = 0;
    for (let run = 0; run < RUNS; run++) {
      const found = await problemsOf(c).catch((error) => [`error: ${error instanceof Error ? error.message : String(error)}`]);
      if (found.length === 0) passed++;
      for (const problem of found) problems.add(problem);
    }
    if (passed === RUNS) correct++;
    say(`${passed === RUNS ? "ok  " : "FAIL"} ${passed}/${RUNS} ${nameOf(c)}`);
    for (const problem of problems) say(`       ${problem}`);
  }
  const seconds = (Date.now() - started) / 1000 / (cases.length * RUNS);
  say(`${correct} of ${cases.length} correct, ${seconds.toFixed(1)} s per call`);
  return correct === cases.length;
}

interface Certificate {
  file: string;
  skill: string;
  forSkill: string;
  holderName: string | null;
  validFrom: string | null;
  validTo: string | null;
}

// Every field of the certificate must match: holder, both dates, and whether it is for the skill.
async function certificateProblems(expected: Certificate): Promise<string[]> {
  const file = readFileSync(`tests/ai-eval/cases/${expected.file}`);
  const check = checkCertificateFile(expected.file, file.length);
  if (!check.ok) return [check.error.key];
  const facts = await readCertificate(check.type, file.toString("base64"), expected.skill, CERTIFICATE_MODEL);
  return (["holderName", "validFrom", "validTo", "forSkill"] as const).flatMap((field) => differs(field, expected[field], facts[field]));
}

interface Question {
  question: string;
  search?: string; // part of a person's name the search must hold; without it the search must stay empty
  skills: string[];
  statuses: string[];
  levels: string[];
}

// The filters the matrix would get. A filter that is not set counts as empty.
async function questionProblems(expected: Question): Promise<string[]> {
  const { filters } = toFilters(await questionToAnswer(expected.question, SKILL_NAMES, LEVELS), SKILLS, LEVELS);
  const skills = (filters?.skillIds ?? []).map((id) => SKILLS.find((skill) => skill.id === id)!.name);
  const search = filters?.search ?? "";
  const searchOk = expected.search ? search.toLowerCase().includes(expected.search.toLowerCase()) : search === "";
  return [
    ...differs("skills", sorted(expected.skills), sorted(skills)),
    ...differs("statuses", sorted(expected.statuses), sorted(filters?.statuses ?? [])),
    ...differs("levels", sorted(expected.levels), sorted(filters?.levels ?? [])),
    ...(searchOk ? [] : [`search: expected ${expected.search ? `"${expected.search}"` : "nothing"}, got "${search}"`]),
  ];
}

// The skill the dialog would warn about, or none.
async function similarProblems(expected: { name: string; similar: string | null }): Promise<string[]> {
  return differs("similar", expected.similar, existingSkill(await similarSkill(expected.name, SKILL_NAMES), SKILL_NAMES));
}

interface Sheet {
  headers: string[];
  columns: Record<string, string | null>;
}

// The columns the import would use: the code first, then the AI for the titles left over,
// exactly as the import dialog does it.
async function columnProblems(expected: Sheet): Promise<string[]> {
  const byCode = guessColumns(expected.headers);
  const left = unusedColumns(expected.headers, byCode);
  const titles = left.map((column) => expected.headers[column]);
  const askAi = titles.length > 0 && Object.values(byCode).includes(null);
  const columns = askAi ? withProposed(byCode, columnsFromHeaders(await matchColumns(titles), titles), left) : byCode;
  return IMPORT_FIELDS.flatMap((field) => {
    const column = columns[field];
    return differs(field, expected.columns[field], column === null ? null : expected.headers[column]);
  });
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set in .env.local.");
  say(`AI evaluation, ${new Date().toISOString().slice(0, 10)}, each case ${RUNS} time${RUNS === 1 ? "" : "s"}`);
  say(`Model: ${MODEL}${CERTIFICATE_MODEL === MODEL ? "" : `, certificates read with ${CERTIFICATE_MODEL}`}`);

  const results = [
    await score("Certificates", load<Certificate>("expected.json"), (c) => `${c.file} for ${c.skill}`, certificateProblems),
    await score("Questions about the matrix", load<Question>("questions.json"), (c) => `"${c.question}"`, questionProblems),
    await score("Similar skill names", load<{ name: string; similar: string | null }>("similar-skills.json"), (c) => `"${c.name}"`, similarProblems),
    await score("Column titles of an import file", load<Sheet>("import-columns.json"), (c) => c.headers.join(", "), columnProblems),
  ];
  const passed = results.every(Boolean);
  say(`\n${passed ? "PASSED" : "FAILED"}`);
  writeFileSync("tests/ai-eval/last-run.txt", `${lines.join("\n")}\n`);
  if (!passed) process.exit(1);
}

main().catch((error) => {
  console.error(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
