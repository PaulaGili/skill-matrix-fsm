import { formatDate, isIsoDate } from "./status";

// What the AI reads from a certificate. Every field can be missing.
export interface CertificateFacts {
  holderName: string | null;
  validFrom: string | null;
  validTo: string | null;
}

export interface Suggestion {
  validFrom: string | null;
  validTo: string | null;
  notes: string[];
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
export function checkFacts(facts: CertificateFacts, personName: string, today: string): Suggestion {
  let validFrom = facts.validFrom && isIsoDate(facts.validFrom) ? facts.validFrom : null;
  let validTo = facts.validTo && isIsoDate(facts.validTo) ? facts.validTo : null;
  const notes: string[] = [];

  if (validFrom && validTo && validTo < validFrom) {
    notes.push("The dates on the certificate are not in order, so they were left out.");
    validFrom = validTo = null;
  }
  if (!validFrom && !validTo) notes.push("No validity dates were found.");
  if (validTo && validTo < today) notes.push(`This certificate expired on ${formatDate(validTo)}.`);

  if (!facts.holderName) {
    notes.push("No holder name was found. Check that the certificate belongs to this person.");
  } else {
    const holder = words(facts.holderName);
    if (!words(personName).every((word) => holder.includes(word))) notes.push(`The certificate is issued to "${facts.holderName}", not to ${personName}.`);
  }
  return { validFrom, validTo, notes };
}
