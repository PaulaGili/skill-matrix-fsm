import type { Page } from "@playwright/test";

export const PREFIX = `${process.env.NEXT_PUBLIC_CANDIDATE_ID ?? "paulagili"}::`;

export function daysFromToday(days: number): string {
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

// Answers the proxy calls of the app in the browser and records them. Each test gets its own
// copy of the data, and a write changes what the next read returns, as in FSM.
export async function mockFsm(page: Page, options: { fail?: boolean } = {}): Promise<FsmCall[]> {
  const calls: FsmCall[] = [];
  let tags = [...TAGS];
  let skills = [...SKILLS];
  let certificates = [...CERTIFICATES];
  let created = 8;
  const nextId = (letter: string) => `${letter}${++created}`;
  await page.route("**/api/health", (route) => route.fulfill({ json: { ok: true, companyName: "Mock" } }));
  // No AI unless a test switches it on, so a key in .env.local never causes a real call.
  await page.route("**/api/ai", (route) => route.fulfill({ json: { enabled: false } }));
  await page.route("**/api/fsm/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace("/api/fsm/", "");
    const body = request.postDataJSON();
    calls.push({ method, path, body });
    const page1 = (content: unknown[]) => route.fulfill({ json: { content, last: true } });
    // The bulk routes answer 207 with one result per item.
    const bulk = (results: { status: number; resource?: unknown; error?: { detail: string } }[]) =>
      route.fulfill({ status: 207, json: { hasErrors: results.some((result) => result.status >= 400), results } });

    if (options.fail) return route.fulfill({ status: 500, json: { message: "FSM is down" } });
    if (path === "query/v1") return route.fulfill({ json: { data: body.query.includes("FROM Person") ? PERSONS : certificates, lastPage: 1 } });
    if (path === "skill/v1/tags/search") return page1(tags);
    if (path === "skill/v1/skills/search") return page1(skills);
    if (path === "skill/v1/scales/search") return page1([{ id: "SCALE", name: `${PREFIX}Levels`, deleted: false }]);
    if (path.endsWith("/proficiencies/search")) return page1(LEVELS);

    // An item with an id is updated, one without is created.
    if (path === "skill/v2/tags" && method === "POST") {
      return bulk(
        body.map((item: { id?: string; name: string }) => {
          const old = tags.find((t) => t.id === item.id);
          if (item.id && !old) return { status: 404, error: { detail: "Tag not found." } };
          const changed = { ...(old ?? tag(nextId("T"), "")), ...item };
          tags = [...tags.filter((t) => t.id !== changed.id), changed];
          return { status: item.id ? 200 : 201, resource: changed };
        }),
      );
    }
    if (path === "skill/v2/tags" && method === "DELETE") {
      const inUse = skills.some((s) => s.tagId === body[0].id);
      if (!inUse) tags = tags.filter((t) => t.id !== body[0].id);
      return bulk([inUse ? { status: 400, error: { detail: "The tag is linked to one or more skills." } } : { status: 200 }]);
    }
    if (path === "skill/v2/skills" && method === "POST") {
      return bulk(
        body.map((item: { id?: string; tagId: string; technician: string; startDate: string; endDate?: string }) => {
          const old = skills.find((s) => s.id === item.id);
          if (item.id && !old) return { status: 404, error: { detail: "Skill not found." } };
          const tagName = tags.find((t) => t.id === item.tagId)!.name.replace(PREFIX, "");
          // Like FSM, the mock gives a new skill the first level.
          const changed = old
            ? { ...old, startDate: item.startDate, endDate: item.endDate ?? old.endDate }
            : { ...skill(nextId("A"), item.tagId, tagName, item.technician, item.endDate ?? "9999-12-31", 1), startDate: item.startDate };
          skills = [...skills.filter((s) => s.id !== changed.id), changed];
          return { status: old ? 200 : 201, resource: changed };
        }),
      );
    }
    if (path === "skill/v2/skills" && method === "DELETE") {
      const ids = body.map((item: { id: string }) => item.id);
      skills = skills.filter((s) => !ids.includes(s.id));
      return bulk(ids.map(() => ({ status: 200 })));
    }
    // A PATCH answers with no body.
    if (method === "PATCH" && /^skill\/v1\/tags\/[^/]+\/skills\/[^/]+$/.test(path)) {
      const id = path.split("/").pop();
      skills = skills.map((s) => (s.id === id ? { ...s, ...body, proficiencyName: body.proficiencyId ? s.proficiencyName : null } : s));
      return route.fulfill({ status: 200, body: "" });
    }
    if (path === "data/v4/Attachment" && method === "POST") {
      const a = { id: nextId("C"), fileName: body.fileName, type: body.type, createDateTime: "2026-11-18T08:00:00Z", "object.objectId": body.object.objectId };
      certificates = [...certificates, { a }];
      return route.fulfill({ json: { data: [{ attachment: a }] } });
    }
    if (path.startsWith("data/v4/Attachment/") && method === "DELETE") {
      certificates = certificates.filter((row) => row.a.id !== path.split("/").pop());
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ status: 404, json: { message: `Not mocked: ${path}` } });
  });
  return calls;
}
