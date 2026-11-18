/**
 * Demo mode: answers the read calls of the app with sample data instead of SAP FSM, so the
 * app can be shown without credentials. Every write is refused. See src/lib/demo/mode.ts.
 */
import { NextResponse } from "next/server";
import { demoData } from "@/lib/demo/data";

export const dynamic = "force-dynamic";

const readOnly = () => NextResponse.json({ message: "Demo mode is read-only. Nothing was changed." }, { status: 403 });

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  if (/^data\/v4\/Attachment\/[^/]+\/content$/.test(path)) return NextResponse.redirect(new URL("/demo-certificate.pdf", request.url));
  return readOnly();
}

export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  const body = await request.json().catch(() => null);
  const data = demoData();

  if (path === "query/v1") return NextResponse.json({ data: String(body?.query).includes("FROM Person") ? data.persons : data.attachments, lastPage: 1 });
  if (path === "skill/v1/tags/search") return NextResponse.json({ content: data.tags, last: true });
  if (path === "skill/v1/skills/search") return NextResponse.json({ content: data.skills, last: true });
  if (/^skill\/v1\/scales\/[^/]+\/proficiencies\/search$/.test(path)) return NextResponse.json({ content: data.levels, last: true });
  return readOnly();
}

export const PATCH = readOnly;
export const PUT = readOnly;
export const DELETE = readOnly;
