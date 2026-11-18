// GET /api/ai: tells the UI whether the AI features are configured.
import { NextResponse } from "next/server";
import { aiEnabled } from "@/lib/ai/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ enabled: aiEnabled() });
}
