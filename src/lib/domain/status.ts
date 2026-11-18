// Assignment status and validity dates. Dates are "yyyy-MM-dd" strings, as FSM stores them,
// and are compared as text: new Date("2026-11-17") is midnight UTC and can shift the day.

import type { Message } from "@/lib/i18n/translate";

export const OPEN_END_DATE = "9999-12-31"; // how the Skill Service returns "no end date"
export const EXPIRY_WINDOW_DAYS = 30;
export const TIME_ZONE = "Europe/Zurich";

export type AssignmentStatus = "unassigned" | "notYetValid" | "valid" | "expiring" | "expired";

export interface Validity {
  startDate: string | null;
  endDate: string | null;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function todayIso(now = new Date(), timeZone = TIME_ZONE): string {
  // The en-CA locale formats dates as yyyy-MM-dd.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

// "2026-11-17" -> "17.11.2026", the Swiss date format.
export function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

// The end date is the last valid day, so a skill that ends today is expiring, not expired.
export function assignmentStatus(assignment: Validity | null | undefined, today: string): AssignmentStatus {
  if (!assignment) return "unassigned";
  if (assignment.startDate && assignment.startDate > today) return "notYetValid";
  if (!assignment.endDate) return "valid";
  if (assignment.endDate < today) return "expired";
  if (assignment.endDate <= addDays(today, EXPIRY_WINDOW_DAYS)) return "expiring";
  return "valid";
}

// The date that matters for a cell, e.g. "until 29.11.2026", as a message to translate.
export function validityHint(validity: Validity, status: AssignmentStatus): Message {
  if (status === "notYetValid" && validity.startDate) return { key: "hint.from", params: { date: formatDate(validity.startDate) } };
  if (!validity.endDate) return { key: "hint.noEnd" };
  return { key: status === "expired" ? "hint.ended" : "hint.until", params: { date: formatDate(validity.endDate) } };
}

// Returns a message for the user, or null when the dates are fine. Both dates are optional.
// An empty "valid from" is saved as today, so "valid to" cannot be in the past then.
export function validateValidity(startDate: string | null, endDate: string | null, today = todayIso()): Message | null {
  if (startDate && !isIsoDate(startDate)) return { key: "validity.fromInvalid" };
  if (endDate && !isIsoDate(endDate)) return { key: "validity.toInvalid" };
  if (!startDate && endDate && endDate < today) return { key: "validity.toInPast" };
  if (startDate && endDate && endDate < startDate) return { key: "validity.toBeforeFrom" };
  return null;
}
