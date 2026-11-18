// The rule of the shared company, checked on the server: a request may only write what is
// ours. The checks in the services run in the browser and give the user a clear message.
// This one cannot be skipped by calling the proxy directly.
import { isOwnName } from "@/lib/candidate";
import { checkCertificateFile } from "@/lib/domain/certificate";

// What FSM holds in our namespace, read on the server when a write needs it.
export interface OwnData {
  tagIds(): Promise<Set<string>>;
  skillIds(): Promise<Set<string>>;
  attachmentIds(): Promise<Set<string>>;
  scaleIds(): Promise<Set<string>>;
}

export function isRead(method: string, segments: string[]): boolean {
  if (method === "GET" || method === "HEAD") return true;
  // The Query API and every ".../search" of the Skill Service are reads sent as POST.
  return method === "POST" && (segments[0] === "query" || segments[segments.length - 1] === "search");
}

const items = (body: unknown): Record<string, unknown>[] | null =>
  Array.isArray(body) && body.length > 0 && body.every((item) => item !== null && typeof item === "object") ? body : null;
const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

async function allIn(ids: (string | null)[], own: () => Promise<Set<string>>): Promise<boolean> {
  if (ids.some((id) => id === null)) return false;
  const known = await own();
  return ids.every((id) => known.has(id!));
}

// The reason a write is refused, or null when it only touches what is ours. The app sends
// nine kinds of write. Any other write is refused, because nothing here needs it.
export async function writeRefusal(method: string, segments: string[], body: unknown, own: OwnData): Promise<string | null> {
  const path = segments.join("/");
  const list = items(body);
  const one = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  const notOurs = (what: string) => `This request would change ${what} outside the namespace of this app.`;

  // Skills of the catalogue (FSM tags): created or renamed with our prefix, deleted by id.
  if (path === "skill/v2/tags" && method === "POST" && list) {
    if (!list.every((tag) => isOwnName(text(tag.name) ?? ""))) return notOurs("a tag");
    const existing = list.filter((tag) => tag.id !== undefined).map((tag) => text(tag.id));
    return existing.length === 0 || (await allIn(existing, own.tagIds)) ? null : notOurs("a tag");
  }
  if (path === "skill/v2/tags" && method === "DELETE" && list) {
    return (await allIn(
      list.map((tag) => text(tag.id)),
      own.tagIds,
    ))
      ? null
      : notOurs("a tag");
  }

  // Assignments (FSM skills): always on one of our tags, and an existing one must be ours.
  if (path === "skill/v2/skills" && method === "POST" && list) {
    if (
      !(await allIn(
        list.map((skill) => text(skill.tagId)),
        own.tagIds,
      ))
    )
      return notOurs("a skill");
    const existing = list.filter((skill) => skill.id !== undefined).map((skill) => text(skill.id));
    return existing.length === 0 || (await allIn(existing, own.skillIds)) ? null : notOurs("a skill");
  }
  if (path === "skill/v2/skills" && method === "DELETE" && list) {
    return (await allIn(
      list.map((skill) => text(skill.id)),
      own.skillIds,
    ))
      ? null
      : notOurs("a skill");
  }
  if (method === "PATCH" && segments.length === 6 && path.startsWith("skill/v1/tags/") && segments[4] === "skills") {
    return (await allIn([segments[3]], own.tagIds)) && (await allIn([segments[5]], own.skillIds)) ? null : notOurs("a skill");
  }

  // The proficiency scale: created with our prefix, deleted by id.
  if (path === "skill/v1/scales" && method === "POST" && one) return isOwnName(text(one.name) ?? "") ? null : notOurs("a scale");
  if (path === "skill/v2/scales" && method === "DELETE" && one) return (await allIn([text(one.id)], own.scaleIds)) ? null : notOurs("a scale");

  // Certificates (FSM attachments): uploaded to one of our skills, deleted when they hang on one.
  if (path === "data/v4/Attachment" && method === "POST" && one) {
    const target = one.object !== null && typeof one.object === "object" ? (one.object as Record<string, unknown>) : {};
    if (target.objectType !== "SKILL" || !(await allIn([text(target.objectId)], own.skillIds))) return notOurs("an attachment");
    // The same file rules as in the browser, on the size of the decoded file.
    const content = (text(one.fileContent) ?? "").replace(/=+$/, "");
    const file = checkCertificateFile(text(one.fileName) ?? "", Math.floor((content.length * 3) / 4));
    return file.ok && file.type === one.type ? null : "A certificate must be a PDF, JPG or PNG of up to 5 MB.";
  }
  if (method === "DELETE" && segments.length === 4 && path.startsWith("data/v4/Attachment/")) {
    return (await allIn([segments[3]], own.attachmentIds)) ? null : notOurs("an attachment");
  }

  return `${method} ${path} is not a write this app makes.`;
}
