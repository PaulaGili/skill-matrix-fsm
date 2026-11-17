// Fails if the OAuth secret reached anything the browser downloads: the static bundle or the
// prerendered pages. Run after "next build". In CI the secret value comes from .env.example.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function readEnv(file, key) {
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${key}=`));
  return (
    line
      ?.slice(key.length + 1)
      .trim()
      .replace(/^["']|["']$/g, "") || undefined
  );
}

if (!existsSync(".next/static")) {
  console.error('.next/static not found. Run "npm run build" first.');
  process.exit(1);
}

const secret = readEnv(".env.local", "FSM_CLIENT_SECRET") ?? readEnv(".env.example", "FSM_CLIENT_SECRET");
const aiKey = readEnv(".env.local", "ANTHROPIC_API_KEY");
const forbidden = ["access_token", ...(secret ? [secret] : []), ...(aiKey ? [aiKey] : [])];

function listFiles(dir, pattern) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .map((name) => join(dir, name))
    .filter((file) => pattern.test(file));
}

// .next/server/app also holds server code, so only its prerendered output is checked.
const files = [...listFiles(".next/static", /\.(js|css|json|txt)$/), ...listFiles(".next/server/app", /\.(html|rsc)$/)];

const leaks = files.filter((file) => {
  const content = readFileSync(file, "utf8");
  return forbidden.some((text) => content.includes(text));
});

if (leaks.length > 0) {
  console.error(`Server-only values found in browser files:\n${leaks.join("\n")}`);
  process.exit(1);
}
console.log(`Browser bundle clean (${files.length} files checked).`);
