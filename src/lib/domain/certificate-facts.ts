import type { Message } from "@/lib/i18n/translate";
import { formatDate, isIsoDate } from "./status";

// What the AI reads from a certificate. Every field can be missing.
export interface CertificateFacts {
  holderName: string | null;
  validFrom: string | null;
  validTo: string | null;
  forSkill: "yes" | "no" | "unclear"; // is the certificate for the skill it was uploaded to?
}

// What the certificate is compared with: the skill, and the validity already stored when the
// assignment exists.
export interface CheckContext {
  skillName: string;
  stored?: { startDate: string | null; endDate: string | null };
}

export interface Suggestion {
  validFrom: string | null;
  validTo: string | null;
  notes: Message[];
}

function words(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

// The AI only reads. This code decides what is usable: dates must be real dates in the
// right order, and anything the manager should look at twice becomes a note.
export function checkFacts(facts: CertificateFacts, personName: string, today: string, context?: CheckContext): Suggestion {
  let validFrom = facts.validFrom && isIsoDate(facts.validFrom) ? facts.validFrom : null;
  let validTo = facts.validTo && isIsoDate(facts.validTo) ? facts.validTo : null;
  const notes: Message[] = [];

  if (validFrom && validTo && validTo < validFrom) {
    notes.push({ key: "facts.notInOrder" });
    validFrom = validTo = null;
  }
  if (!validFrom && !validTo) notes.push({ key: "facts.noDates" });
  if (validTo && validTo < today) notes.push({ key: "facts.expired", params: { date: formatDate(validTo) } });

  if (!facts.holderName) {
    notes.push({ key: "facts.noHolder" });
  } else {
    const holder = words(facts.holderName);
    if (!words(personName).every((word) => holder.includes(word))) {
      notes.push({ key: "facts.otherHolder", params: { holder: facts.holderName, person: personName } });
    }
  }
  if (context && facts.forSkill === "no") notes.push({ key: "facts.otherSkill", params: { skill: context.skillName } });

  // The stored validity should match the proof. Only a date printed on the certificate is compared.
  const stored = context?.stored;
  if (stored?.startDate && validFrom && stored.startDate !== validFrom) {
    notes.push({ key: "facts.fromDiffers", params: { certificate: formatDate(validFrom), assignment: formatDate(stored.startDate) } });
  }
  if (stored && validTo && stored.endDate !== validTo) {
    notes.push(
      stored.endDate
        ? { key: "facts.toDiffers", params: { certificate: formatDate(validTo), assignment: formatDate(stored.endDate) } }
        : { key: "facts.toDiffersOpen", params: { certificate: formatDate(validTo) } },
    );
  }
  return { validFrom, validTo, notes };
}

// The AI names an existing skill that means the same as a new name. Only a name that is
// really in the catalogue counts.
export function existingSkill(similar: string | null, existing: string[]): string | null {
  return existing.find((name) => name.toLowerCase() === similar?.trim().toLowerCase()) ?? null;
}
