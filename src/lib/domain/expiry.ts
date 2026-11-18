import type { Message } from "@/lib/i18n/translate";

export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

// Assignments whose last valid day is today or within the next `days` days, soonest first.
// Expired and open-ended assignments are not part of the list.
export function expiringWithin<A extends { endDate: string | null }>(assignments: A[], today: string, days: number): A[] {
  return assignments
    .filter((assignment) => assignment.endDate !== null && assignment.endDate >= today && daysUntil(assignment.endDate, today) <= days)
    .sort((a, b) => a.endDate!.localeCompare(b.endDate!));
}

// Assignments whose last valid day is in the past, the latest one first.
export function alreadyExpired<A extends { endDate: string | null }>(assignments: A[], today: string): A[] {
  return assignments.filter((assignment) => assignment.endDate !== null && assignment.endDate < today).sort((a, b) => b.endDate!.localeCompare(a.endDate!));
}

export function dueText(days: number): Message {
  if (days < 0) return days === -1 ? { key: "due.yesterday" } : { key: "due.daysAgo", params: { count: -days } };
  if (days === 0) return { key: "due.today" };
  return days === 1 ? { key: "due.tomorrow" } : { key: "due.inDays", params: { count: days } };
}
