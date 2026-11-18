// Demo mode is switched on at build time with NEXT_PUBLIC_DEMO_MODE=1. The app then talks
// to /api/demo instead of the FSM proxy: sample data, read-only.
import { setProxyBaseUrl } from "@/lib/fsm/client";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

if (DEMO_MODE) setProxyBaseUrl("/api/demo");
