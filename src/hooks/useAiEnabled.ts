import { useAsyncData } from "./useAsyncData";
import { isAiEnabled } from "@/lib/ai/client";

// Whether the AI features are configured. The server is asked once per visit.
export function useAiEnabled(): boolean {
  return useAsyncData(isAiEnabled).data === true;
}
