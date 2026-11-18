// npm run mcp: a read-only MCP server, so an AI assistant can ask about the skill matrix.
// It reads through the running app's proxy (start `npm run dev` first) and has no tool that
// writes. Nothing may be printed to stdout, which carries the protocol.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { todayIso } from "@/lib/domain/status";
import { setProxyBaseUrl } from "@/lib/fsm/client";
import { loadMatrixData } from "@/lib/fsm/services/matrix";
import { expiring, listSkills, skillsOfPerson, whoHolds } from "./answers";

setProxyBaseUrl(`${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/fsm`);

const server = new McpServer({ name: "skill-matrix", version: "1.0.0" });

const readOnly = { readOnlyHint: true };
const json = (result: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] });

// Every tool loads the current data, so an answer is never older than the question.
server.registerTool(
  "list_skills",
  { description: "All skills of the catalogue with the number of technicians who hold each one today.", annotations: readOnly },
  async () => json(listSkills(await loadMatrixData(), todayIso())),
);

server.registerTool(
  "who_holds",
  {
    description: "Technicians with an assignment of one skill, with status (valid, expiring, expired, notYetValid), level, validity and certificate.",
    inputSchema: { skill: z.string().describe("Skill name as in list_skills") },
    annotations: readOnly,
  },
  async ({ skill }) => json(whoHolds(await loadMatrixData(), todayIso(), skill)),
);

server.registerTool(
  "skills_of_person",
  {
    description: "All skill assignments of one technician, with status, level and validity.",
    inputSchema: { name: z.string().describe("Name or part of the name") },
    annotations: readOnly,
  },
  async ({ name }) => json(skillsOfPerson(await loadMatrixData(), todayIso(), name)),
);

server.registerTool(
  "expiring_assignments",
  {
    description: "Assignments that end within the next days, soonest first.",
    inputSchema: { days: z.number().int().min(1).max(365).describe("Size of the window in days") },
    annotations: readOnly,
  },
  async ({ days }) => json(expiring(await loadMatrixData(), todayIso(), days)),
);

server.connect(new StdioServerTransport()).catch((error) => {
  console.error(error);
  process.exit(1);
});
