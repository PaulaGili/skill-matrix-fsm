// npm run eval:ai: reads five invented certificates with the real AI service and compares
// the answers with the known ones. Needs ANTHROPIC_API_KEY in .env.local and costs a few cents.
import { readFileSync } from "node:fs";
import { readCertificate } from "@/lib/ai/read-certificate";
import { checkCertificateFile } from "@/lib/domain/certificate";

interface Expected {
  file: string;
  holderName: string | null;
  validFrom: string | null;
  validTo: string | null;
}

const FIELDS = ["holderName", "validFrom", "validTo"] as const;
const same = (a: string | null, b: string | null) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

async function main() {
  const cases: Expected[] = JSON.parse(readFileSync("tests/ai-eval/expected.json", "utf8"));
  let correct = 0;
  for (const expected of cases) {
    const file = readFileSync(`tests/ai-eval/cases/${expected.file}`);
    const check = checkCertificateFile(expected.file, file.length);
    if (!check.ok) throw new Error(check.error);

    const started = Date.now();
    const facts = await readCertificate(check.type, file.toString("base64"));
    const wrong = FIELDS.filter((field) => !same(facts[field], expected[field]));
    correct += FIELDS.length - wrong.length;

    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${wrong.length === 0 ? "ok  " : "FAIL"} ${expected.file} (${seconds}s)`);
    for (const field of wrong) console.log(`       ${field}: expected ${expected[field]}, got ${facts[field]}`);
  }
  const total = cases.length * FIELDS.length;
  console.log(`\n${correct} of ${total} fields correct`);
  if (correct < total) process.exit(1);
}

main().catch((error) => {
  console.error(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
