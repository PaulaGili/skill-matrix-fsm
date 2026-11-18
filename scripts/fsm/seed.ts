// npm run seed: a small demo data set in our namespace that shows every status.
// Safe to run twice: existing skills and assignments are skipped.
import { cellKey, indexAssignments } from "@/lib/domain/matrix";
import { addDays, todayIso } from "@/lib/domain/status";
import { createAssignment, listAssignments } from "@/lib/fsm/services/assignments";
import { listCertificates, uploadCertificates } from "@/lib/fsm/services/certificates";
import { listActivePersons } from "@/lib/fsm/services/persons";
import { ensureLevelScale } from "@/lib/fsm/services/scale";
import { createSkill, listSkills } from "@/lib/fsm/services/skills";
import { connectToProxy, run, sampleCertificate } from "./env";

const SKILLS = [
  { name: "Welding", description: "MIG/MAG welding" },
  { name: "First Aid", description: null },
  { name: "Working at Heights", description: "Fall protection" },
  { name: "Electrical Switching", description: "Switching permit" },
  { name: "Gas Engines", description: null },
];

// person = position in the list of active employees; from/to = days relative to today.
const ASSIGNMENTS = [
  { person: 0, skill: "Welding", level: 3, from: -400, to: null, certificate: true },
  { person: 0, skill: "First Aid", level: 1, from: -300, to: 12, certificate: true },
  { person: 1, skill: "Welding", level: 2, from: -200, to: 300, certificate: false },
  { person: 1, skill: "Working at Heights", level: 2, from: -500, to: -20, certificate: true },
  { person: 2, skill: "Electrical Switching", level: 3, from: -100, to: 700, certificate: true },
  { person: 2, skill: "First Aid", level: 2, from: -30, to: 30, certificate: false },
  { person: 3, skill: "Gas Engines", level: 1, from: 15, to: 380, certificate: false },
  { person: 4, skill: "Working at Heights", level: 1, from: -10, to: null, certificate: false },
  { person: 5, skill: "Electrical Switching", level: 2, from: -800, to: -1, certificate: false },
  { person: 6, skill: "Welding", level: 1, from: 0, to: null, certificate: false },
];

run(async () => {
  await connectToProxy();
  const today = todayIso();
  const scale = await ensureLevelScale();

  const skills = await listSkills();
  for (const { name, description } of SKILLS) {
    if (skills.some((skill) => skill.name === name)) continue;
    skills.push(await createSkill({ name, description, scaleId: scale.id }));
    console.log(`Created skill ${name}`);
  }

  // Sorting by id as well keeps the choice stable between runs.
  const employees = (await listActivePersons())
    .filter((person) => person.isTechnician)
    .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id));
  const existing = indexAssignments(await listAssignments(), todayIso());
  const withCertificate = new Set((await listCertificates()).map((certificate) => certificate.assignmentId));

  for (const row of ASSIGNMENTS) {
    const person = employees[row.person];
    const skill = skills.find((s) => s.name === row.skill);
    const level = scale.levels.find((l) => l.level === row.level);
    if (!person || !skill || !level) throw new Error(`Cannot seed ${row.skill} for person ${row.person}.`);

    let assignment = existing.get(cellKey(person.id, skill.id));
    if (!assignment) {
      assignment = await createAssignment(skill.id, person.id, {
        levelId: level.id,
        startDate: addDays(today, row.from),
        endDate: row.to === null ? null : addDays(today, row.to),
      });
      console.log(`Assigned ${skill.name} to ${person.displayName}`);
    }
    if (row.certificate && !withCertificate.has(assignment.id)) {
      const failures = await uploadCertificates(skill.id, assignment.id, [sampleCertificate("sample-certificate.pdf")]);
      if (failures.length > 0) throw new Error(`Upload failed: ${failures.map((failure) => failure.fileName).join(", ")}`);
    }
  }
  console.log("Seed done.");
});
