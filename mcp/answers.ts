// What the MCP tools answer, as pure functions over the data the matrix loads. The rules
// (status, expiry window, which duplicate counts) are the same ones the app uses.
import { daysUntil } from "@/lib/domain/expiry";
import { HELD_TODAY, buildCells, filterPersons } from "@/lib/domain/matrix";
import type { MatrixData } from "@/lib/fsm/services/matrix";

// `ofPerson` keeps the rows of some persons, by id: two technicians can share a name.
function rows(data: MatrixData, today: string, ofPerson: (personId: string) => boolean = () => true) {
  const withCertificate = new Set(data.certificates.map((certificate) => certificate.assignmentId));
  const technicians = data.persons.filter((person) => person.isTechnician);
  return [...buildCells(data.assignments, withCertificate, today).values()].flatMap((cell) => {
    const person = technicians.find((p) => p.id === cell.assignment.personId);
    const skill = data.skills.find((s) => s.id === cell.assignment.skillId);
    if (!person || !skill || !ofPerson(person.id)) return [];
    return [
      {
        person: person.displayName,
        skill: skill.name,
        status: cell.status,
        level: cell.assignment.levelName,
        validFrom: cell.assignment.startDate,
        validTo: cell.assignment.endDate,
        hasCertificate: cell.hasCertificate,
      },
    ];
  });
}

export function listSkills(data: MatrixData, today: string) {
  const all = rows(data, today);
  return data.skills.map((skill) => ({
    skill: skill.name,
    description: skill.description,
    heldToday: all.filter((row) => row.skill === skill.name && (HELD_TODAY as readonly string[]).includes(row.status)).length,
  }));
}

// Everyone with an assignment of this skill, whatever its status. The caller reads the status.
export function whoHolds(data: MatrixData, today: string, skillName: string) {
  const skill = data.skills.find((s) => s.name.toLowerCase() === skillName.trim().toLowerCase());
  if (!skill) return { error: `There is no skill called "${skillName}".`, skills: data.skills.map((s) => s.name) };
  return rows(data, today).filter((row) => row.skill === skill.name);
}

export function skillsOfPerson(data: MatrixData, today: string, name: string) {
  const ids = filterPersons(data.persons, name, false).map((person) => person.id);
  if (ids.length === 0) return { error: `No technician matches "${name}".` };
  return rows(data, today, (personId) => ids.includes(personId));
}

export function expiring(data: MatrixData, today: string, days: number) {
  return rows(data, today)
    .flatMap((row) => (row.validTo === null ? [] : [{ ...row, daysLeft: daysUntil(row.validTo, today) }]))
    .filter((row) => row.daysLeft >= 0 && row.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
