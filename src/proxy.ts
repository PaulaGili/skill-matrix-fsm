import { NextResponse, type NextRequest } from "next/server";
import { accessAllowed } from "@/lib/access";

// Runs before every page and every API route. With APP_ACCESS_CODE set, nothing is served
// without the code: the FSM proxy and the AI routes included. Without it, as on a developer
// machine, everything passes.
export function proxy(request: NextRequest) {
  if (accessAllowed(request.headers.get("authorization"), process.env.APP_ACCESS_CODE)) return NextResponse.next();
  return new NextResponse("Access code required.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Skill Management"' } });
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
