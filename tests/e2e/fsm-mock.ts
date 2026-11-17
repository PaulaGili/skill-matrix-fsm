import type { Page } from "@playwright/test";

const PREFIX = `${process.env.NEXT_PUBLIC_CANDIDATE_ID ?? "paulagili"}::`;

function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" });
}

const person = (id: string, firstName: string, lastName: string, type = "EMPLOYEE") => ({
  p: { id, firstName, lastName, jobTitle: "Service Technician", type },
});
const tag = (id: string, name: string) => ({ id, name: PREFIX + name, description: " ", scaleId: "SCALE", deleted: false });
const skill = (id: string, tagId: string, tagName: string, technicianId: string, endDate: string, level: number) => ({
  id,
  tagId,
  tagName: PREFIX + tagName,
  technicianId,
  startDate: "2025-01-01",
  endDate,
  proficiencyId: `L${level}`,
  proficiencyName: level === 1 ? "Basic" : "Expert",
  proficiencyLevel: level,
  deleted: false,
});

// Three technicians (one with her system-user twin), two skills and one assignment per status.
const PERSONS = [person("P1", "Anna", "Aerni"), person("P1U", "Anna", "Aerni", "ERPUSER"), person("P2", "Beat", "Baumann"), person("P3", "Carla", "Conti")];
const TAGS = [tag("T1", "Welding"), tag("T2", "First Aid")];
const SKILLS = [
  skill("A1", "T1", "Welding", "P1", "9999-12-31", 2),
  skill("A2", "T1", "Welding", "P2", daysFromToday(10), 1),
  skill("A3", "T2", "First Aid", "P3", daysFromToday(-5), 1),
];
const CERTIFICATES = [{ a: { id: "C1", fileName: "welding.pdf", type: "PDF", createDateTime: "2026-01-10T08:00:00Z", "object.objectId": "A1" } }];
const LEVELS = [
  { id: "L1", name: "Basic", level: 1 },
  { id: "L2", name: "Expert", level: 2 },
];

export interface FsmCall {
  method: string;
  path: string;
  body: unknown;
}

// Answers the proxy calls of the app in the browser and records them.
export async function mockFsm(page: Page, options: { fail?: boolean } = {}): Promise<FsmCall[]> {
  const calls: FsmCall[] = [];
  await page.route("**/api/fsm/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/fsm/", "");
    const body = request.postDataJSON();
    calls.push({ method: request.method(), path, body });

    if (options.fail) return route.fulfill({ status: 500, json: { message: "FSM is down" } });
    if (path === "query/v1") return route.fulfill({ json: { data: body.query.includes("FROM Person") ? PERSONS : CERTIFICATES, lastPage: 1 } });
    if (path === "skill/v1/tags/search") return route.fulfill({ json: { content: TAGS, last: true } });
    if (path === "skill/v1/skills/search") return route.fulfill({ json: { content: SKILLS, last: true } });
    if (path.endsWith("/proficiencies/search")) return route.fulfill({ json: { content: LEVELS, last: true } });
    if (path === "skill/v2/skills" && request.method() === "POST") {
      const created = { ...skill("A9", body[0].tagId, "First Aid", body[0].technician, body[0].endDate, 1), startDate: body[0].startDate };
      return route.fulfill({ status: 207, json: { hasErrors: false, results: [{ status: 201, resource: created }] } });
    }
    return route.fulfill({ status: 404, json: { message: `Not mocked: ${path}` } });
  });
  return calls;
}
