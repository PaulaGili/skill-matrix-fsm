// npm run mcp: a read-only MCP server, so an AI assistant can ask about the skill matrix.
// It reads through the proxy of the running app and has no tool that writes. Nothing may be
// printed to stdout, which carries the protocol: a client starts it with `npm run --silent mcp`.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { todayIso } from "@/lib/domain/status";
import { setProxyBaseUrl } from "@/lib/fsm/client";
import { loadMatrixData, type MatrixData } from "@/lib/fsm/services/matrix";
import { expiring, listSkills, skillsOfPerson, whoHolds } from "./answers";

const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
setProxyBaseUrl(`${appUrl}/api/fsm`);

// Every request gets a time limit, and the access code when the copy asks for one.
const plainFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  const code = process.env.APP_ACCESS_CODE;
  if (code) headers.set("Authorization", `Basic ${Buffer.from(`mcp:${code}`).toString("base64")}`);
  return plainFetch(input, { ...init, headers, signal: AbortSignal.timeout(15_000) });
};

const server = new McpServer({ name: "skill-matrix", version: "1.0.0" });

const readOnly = { readOnlyHint: true };
const text = (value: string, isError = false) => ({ content: [{ type: "text" as const, text: value }], isError });

// Every tool loads the current data, so an answer is never older than the question. When the
// app does not answer, the assistant is told what to do about it.
async function answer(build: (data: MatrixData) => unknown) {
  try {
    return text(JSON.stringify(build(await loadMatrixData()), null, 2));
  } catch (error) {
    const unreachable = error instanceof TypeError || (error instanceof Error && error.name === "TimeoutError");
    if (unreachable) return text(`The skill matrix app does not answer at ${appUrl}. Start it (npm run dev) or set APP_URL.`, true);
    throw error;
  }
}

server.registerTool(
  "list_skills",
  { description: "All skills of the catalogue with the number of technicians who hold each one today.", annotations: readOnly },
  () => answer((data) => listSkills(data, todayIso())),
);

server.registerTool(
  "who_holds",
  {
    description: "Technicians with an assignment of one skill, with status (valid, expiring, expired, notYetValid), level, validity and certificate.",
    inputSchema: { skill: z.string().trim().min(1).max(200).describe("Skill name as in list_skills") },
    annotations: readOnly,
  },
  ({ skill }) => answer((data) => whoHolds(data, todayIso(), skill)),
);

server.registerTool(
  "skills_of_person",
  {
    description: "All skill assignments of one technician, with status, level and validity.",
    inputSchema: { name: z.string().trim().min(1).max(200).describe("Name or part of the name") },
    annotations: readOnly,
  },
  ({ name }) => answer((data) => skillsOfPerson(data, todayIso(), name)),
);

server.registerTool(
  "expiring_assignments",
  {
    description: "Assignments that end within the next days, soonest first.",
    inputSchema: { days: z.number().int().min(1).max(365).describe("Size of the window in days") },
    annotations: readOnly,
  },
  ({ days }) => answer((data) => expiring(data, todayIso(), days)),
);

server.connect(new StdioServerTransport()).catch((error) => {
  console.error(error);
  process.exit(1);
});
