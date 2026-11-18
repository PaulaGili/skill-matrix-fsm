// What the app keeps in this browser: preferences and the history of changes. Storage can be switched off (private mode): reading then
// gives nothing and writing does nothing, and the app works without the preference.
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

// What was stored as JSON, or null when nothing readable is there.
export function readStoredJson(key: string): unknown {
  try {
    return JSON.parse(readStored(key) ?? "null");
  } catch {
    return null;
  }
}
