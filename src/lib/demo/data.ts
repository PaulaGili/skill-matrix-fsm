// Sample data for demo mode: invented persons, five skills and one assignment per status.
// Dates are relative to today, so the statuses stay meaningful whenever the demo is opened.
import { NAME_PREFIX } from "@/lib/candidate";
import { addDays, todayIso } from "@/lib/domain/status";

const NAMES = ["Anna Aerni", "Beat Baumann", "Carla Conti", "David Dubois", "Elena Egger", "Fabio Ferrari", "Greta Gerber", "Hans Hofer"];
const SKILLS = ["Electrical Switching", "First Aid", "Gas Engines", "Welding", "Working at Heights"];
const LEVELS = ["Basic", "Advanced", "Expert"];

// person, skill, level (1-3), start and end in days from today (null = no end date), certificate
const ASSIGNMENTS: [number, number, number, number, number | null, boolean][] = [
  [0, 3, 3, -400, null, true],
  [0, 1, 1, -300, 12, true],
  [1, 3, 2, -200, 300, false],
  [1, 4, 2, -700, -20, true],
  [2, 0, 3, -100, 700, true],
  [2, 1, 2, -330, 30, false],
  [3, 2, 1, 15, null, false],
  [4, 4, 1, -50, null, false],
  [5, 0, 2, -800, -1, false],
  [5, 3, 1, -30, 60, true],
  [6, 1, 3, -500, 200, true],
  [7, 2, 2, -90, 5, false],
];

export function demoData() {
  const today = todayIso();
  const persons = NAMES.map((name, index) => {
    const [firstName, lastName] = name.split(" ");
    return { p: { id: `P${index}`, firstName, lastName, jobTitle: "Service Technician", type: "EMPLOYEE" } };
  });
  const tags = SKILLS.map((name, index) => ({ id: `T${index}`, name: NAME_PREFIX + name, description: " ", scaleId: "SCALE", deleted: false }));
  const levels = LEVELS.map((name, index) => ({ id: `L${index + 1}`, name, level: index + 1 }));
  const skills = ASSIGNMENTS.map(([person, skill, level, start, end], index) => ({
    id: `A${index}`,
    tagId: `T${skill}`,
    tagName: NAME_PREFIX + SKILLS[skill],
    technicianId: `P${person}`,
    startDate: addDays(today, start),
    endDate: end === null ? "9999-12-31" : addDays(today, end),
    proficiencyId: `L${level}`,
    proficiencyName: LEVELS[level - 1],
    proficiencyLevel: level,
    deleted: false,
  }));
  const attachments = ASSIGNMENTS.flatMap(([, , , start, , certificate], index) =>
    certificate
      ? [
          {
            a: {
              id: `C${index}`,
              fileName: "sample-certificate.pdf",
              type: "PDF",
              createDateTime: `${addDays(today, start)}T08:00:00Z`,
              "object.objectId": `A${index}`,
            },
          },
        ]
      : [],
  );
  return { persons, tags, levels, skills, attachments };
}
