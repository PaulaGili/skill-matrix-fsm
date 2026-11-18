import { NextResponse, type NextRequest } from "next/server";
import { accessAllowed, closedInDemo, needsAccessCode } from "@/lib/access";

// Runs before every page and every API route. With APP_ACCESS_CODE set, nothing is served
// without the code: the FSM proxy and the AI routes included. Without it, as on a developer
// machine, everything passes.
export function proxy(request: NextRequest) {
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
  if (demo && closedInDemo(request.nextUrl.pathname)) return new NextResponse("Not available in the demo.", { status: 403 });
  // Vercel sets VERCEL on its servers.
  if (needsAccessCode({ hosted: Boolean(process.env.VERCEL), demo, code: process.env.APP_ACCESS_CODE })) {
    return new NextResponse("Set APP_ACCESS_CODE or NEXT_PUBLIC_DEMO_MODE=1 before this copy goes online.", { status: 503 });
  }
  if (accessAllowed(request.headers.get("authorization"), process.env.APP_ACCESS_CODE)) return NextResponse.next();
  return new NextResponse("Access code required.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Skill Management"' } });
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
