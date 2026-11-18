import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { CANDIDATE_ID_VALID, NAME_PREFIX } from "@/lib/candidate";
import { dtosParam } from "./dtos";
import { fsmHeaders } from "./headers";
import { getFsmSession } from "./token";
import { isRead, writeRefusal, type OwnData } from "./write-guard";

const PAGE_SIZE = 1000;

// One call to FSM from the server, with the same token and headers as the proxy.
async function fsm<T>(path: string, body: unknown): Promise<T> {
  const session = await getFsmSession(false);
  const response = await fetch(`${session.clusterUrl}${path}`, {
    method: "POST",
    headers: { ...fsmHeaders(session.accountId, session.companyId), Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`FSM answered ${response.status} to the ownership check.`);
  return response.json();
}

// The ids of everything the Skill Service lists under our prefix.
async function searchIds(resource: string, field: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let page = 0; page < 100; page++) {
    const result = await fsm<{ content?: { id: string; deleted?: boolean }[]; last?: boolean }>(`/cloud-skill-service/api/v1/${resource}/search`, {
      filter: [{ field, operator: "like", value: `${NAME_PREFIX}%` }],
      page,
      size: PAGE_SIZE,
    });
    for (const item of result.content ?? []) if (!item.deleted) ids.add(item.id);
    if (result.last || !result.content?.length) break;
  }
  return ids;
}

// The attachments that hang on a skill of one of our tags, with the same join as the app.
async function attachmentIds(): Promise<Set<string>> {
  const query = `SELECT a.id FROM Attachment a JOIN Skill s ON s.id = a.object.objectId JOIN Tag t ON t.id = s.tag WHERE a.object.objectType = 'SKILL' AND t.name LIKE '${NAME_PREFIX}%'`;
  const ids = new Set<string>();
  for (let page = 1; page <= 100; page++) {
    const path = `/api/query/v1?dtos=${encodeURIComponent(dtosParam(["Attachment", "Skill", "Tag"]))}&page=${page}&pageSize=${PAGE_SIZE}`;
    const result = await fsm<{ data?: { a: { id: string } }[]; lastPage?: number }>(path, { query });
    for (const row of result.data ?? []) ids.add(row.a.id);
    if (!result.lastPage || page >= result.lastPage) break;
  }
  return ids;
}

// Each list is read at most once per request, and only when the write needs it.
function ownData(): OwnData {
  const once = <T>(load: () => Promise<T>) => {
    let loaded: Promise<T> | undefined;
    return () => (loaded ??= load());
  };
  return {
    tagIds: once(() => searchIds("tags", "name")),
    skillIds: once(() => searchIds("skills", "tag.name")),
    scaleIds: once(() => searchIds("scales", "name")),
    attachmentIds: once(attachmentIds),
  };
}

// Stands in front of the FSM proxy. Reads pass. A write passes only when it stays inside our
// namespace. The answer is null when the request may go on.
export async function guardFsmWrite(request: NextRequest): Promise<NextResponse | null> {
  const segments = request.nextUrl.pathname
    .replace(/^\/api\/fsm\/?/, "")
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  if (isRead(request.method, segments)) return null;
  const refuse = (status: number, error: string, code = "NOT_OWN_DATA") => NextResponse.json({ error, code }, { status });
  // The prefix goes into a query text, so it has to be a valid candidate id.
  if (!CANDIDATE_ID_VALID) return refuse(403, "NEXT_PUBLIC_CANDIDATE_ID is missing or invalid, so nothing can be written.");
  try {
    const body: unknown = await request
      .clone()
      .json()
      .catch(() => null);
    const refusal = await writeRefusal(request.method, segments, body, ownData());
    return refusal ? refuse(403, refusal) : null;
  } catch (error) {
    // If ownership cannot be checked, the write does not happen.
    const cause = error instanceof Error ? error.message : String(error);
    return refuse(502, `Nothing was written: FSM could not be asked whether this is ours (${cause}).`, "OWNERSHIP_UNKNOWN");
  }
}
