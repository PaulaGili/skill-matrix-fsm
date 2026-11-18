// npm run eval:ai: runs both AI features against the real AI service and compares the
// answers with known ones: five invented certificates, six questions about the matrix and six new skill names.
// Needs ANTHROPIC_API_KEY in .env.local and costs a few cents.
import { readFileSync } from "node:fs";
import { questionToAnswer } from "@/lib/ai/question";
import { readCertificate } from "@/lib/ai/read-certificate";
import { similarSkill } from "@/lib/ai/similar-skill";
import { checkCertificateFile } from "@/lib/domain/certificate";
import { existingSkill } from "@/lib/domain/certificate-facts";
import { toFilters } from "@/lib/domain/question";

interface Expected {
  file: string;
  skill: string;
  forSkill: string;
  holderName: string | null;
  validFrom: string | null;
  validTo: string | null;
}

const FIELDS = ["holderName", "validFrom", "validTo", "forSkill"] as const;
const same = (a: string | null, b: string | null) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

const SKILLS = [
  { id: "s1", name: "Welding" },
  { id: "s2", name: "First Aid" },
  { id: "s3", name: "Working at Heights" },
  { id: "s4", name: "Electrical Switching" },
  { id: "s5", name: "Gas Engines" },
];
const LEVELS = ["Basic", "Advanced", "Expert"];

interface ExpectedFilters {
  question: string;
  skills: string[];
  statuses: string[];
  levels: string[];
}

// Certificates: every field must match the known answer.
async function evalCertificates(): Promise<[number, number]> {
  const cases: Expected[] = JSON.parse(readFileSync("tests/ai-eval/expected.json", "utf8"));
  let correct = 0;
  for (const expected of cases) {
    const file = readFileSync(`tests/ai-eval/cases/${expected.file}`);
    const check = checkCertificateFile(expected.file, file.length);
    if (!check.ok) throw new Error(`${expected.file}: ${check.error.key}`);

    const started = Date.now();
    const facts = await readCertificate(check.type, file.toString("base64"), expected.skill);
    const wrong = FIELDS.filter((field) => !same(facts[field], expected[field]));
    correct += FIELDS.length - wrong.length;

    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${wrong.length === 0 ? "ok  " : "FAIL"} ${expected.file} (${seconds}s)`);
    for (const field of wrong) console.log(`       ${field}: expected ${expected[field]}, got ${facts[field]}`);
  }
  return [correct, cases.length * FIELDS.length];
}

// The same question can get a different answer the next time, so each one is asked RUNS
// times (npm run eval:ai -- 3). The filters the app would set must match every time.
const RUNS = Number(process.argv[2] ?? 1);

async function evalQuestions(): Promise<[number, number]> {
  const cases: ExpectedFilters[] = JSON.parse(readFileSync("tests/ai-eval/questions.json", "utf8"));
  const sorted = (values: string[]) => [...values].sort().join(", ");
  let correct = 0;
  for (const expected of cases) {
    let passed = 0;
    const problems = new Set<string>();
    for (let run = 0; run < RUNS; run++) {
      const { filters } = toFilters(
        await questionToAnswer(
          expected.question,
          SKILLS.map((skill) => skill.name),
          LEVELS,
        ),
        SKILLS,
        LEVELS,
      );
      const got = {
        skills: (filters?.skillIds ?? []).map((id) => SKILLS.find((skill) => skill.id === id)!.name),
        statuses: filters?.statuses ?? [],
        levels: filters?.levels ?? [],
      };
      const wrong = (["skills", "statuses", "levels"] as const).filter((field) => sorted(got[field]) !== sorted(expected[field]));
      if (wrong.length === 0) passed++;
      for (const field of wrong) problems.add(`${field}: expected [${sorted(expected[field])}], got [${sorted(got[field])}]`);
    }
    if (passed === RUNS) correct++;
    console.log(`${passed === RUNS ? "ok  " : "FAIL"} ${passed}/${RUNS} "${expected.question}"`);
    for (const problem of problems) console.log(`       ${problem}`);
  }
  return [correct, cases.length];
}

// New skill names: the existing skill that means the same, or none.
async function evalSimilarSkills(): Promise<[number, number]> {
  const cases: { name: string; similar: string | null }[] = JSON.parse(readFileSync("tests/ai-eval/similar-skills.json", "utf8"));
  const existing = SKILLS.map((skill) => skill.name);
  let correct = 0;
  for (const expected of cases) {
    const answers = new Set<string | null>();
    for (let run = 0; run < RUNS; run++) answers.add(existingSkill(await similarSkill(expected.name, existing), existing));
    const passed = answers.size === 1 && answers.has(expected.similar);
    if (passed) correct++;
    console.log(`${passed ? "ok  " : "FAIL"} "${expected.name}"${passed ? "" : `: expected ${expected.similar}, got ${[...answers].join(" / ")}`}`);
  }
  return [correct, cases.length];
}

async function main() {
  const [fields, allFields] = await evalCertificates();
  console.log(`${fields} of ${allFields} certificate fields correct\n`);
  const [questions, allQuestions] = await evalQuestions();
  console.log(`${questions} of ${allQuestions} questions correct in all ${RUNS} ${RUNS === 1 ? "run" : "runs"}`);
  const [names, allNames] = await evalSimilarSkills();
  console.log(`\n${names} of ${allNames} skill names correct in all ${RUNS} ${RUNS === 1 ? "run" : "runs"}`);
  if (fields < allFields || questions < allQuestions || names < allNames) process.exit(1);
}

main().catch((error) => {
  console.error(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
