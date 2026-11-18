// Assignment status and validity dates. Dates are "yyyy-MM-dd" strings, as FSM stores them,
// and are compared as text: new Date("2026-11-17") is midnight UTC and can shift the day.

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

export function validityHint(validity: Validity, status: AssignmentStatus): string {
  if (status === "notYetValid" && validity.startDate) return `from ${formatDate(validity.startDate)}`;
  if (!validity.endDate) return "no end date";
  return status === "expired" ? `ended ${formatDate(validity.endDate)}` : `until ${formatDate(validity.endDate)}`;
}

// Returns a message for the user, or null when the dates are fine. Both dates are optional.
// An empty "valid from" is saved as today, so "valid to" cannot be in the past then.
export function validateValidity(startDate: string | null, endDate: string | null, today = todayIso()): string | null {
  if (startDate && !isIsoDate(startDate)) return "Valid from is not a valid date.";
  if (endDate && !isIsoDate(endDate)) return "Valid to is not a valid date.";
  if (!startDate && endDate && endDate < today) return "Valid to is in the past. Enter the valid from date as well.";
  if (startDate && endDate && endDate < startDate) return "Valid to must not be before valid from.";
  return null;
}
