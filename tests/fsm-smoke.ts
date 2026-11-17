// npm run smoke: runs the service layer against the real FSM company.
// It creates one throwaway skill in our namespace and deletes everything it created.
import assert from "node:assert/strict";
import { fsmGet } from "@/lib/fsm/client";
import { addDays, todayIso } from "@/lib/domain/status";
import { ConflictError, createAssignment, listAssignments, updateAssignment } from "@/lib/fsm/services/assignments";
import { certificateUrl, listCertificates } from "@/lib/fsm/services/certificates";
import { loadMatrixData } from "@/lib/fsm/services/matrix";
import { OwnershipError } from "@/lib/fsm/services/ownership";
import { listActivePersons } from "@/lib/fsm/services/persons";
import { deleteSkillWithAssignments, retireSkill } from "@/lib/fsm/services/remove";
import { saveAssignment } from "@/lib/fsm/services/save-assignment";
import { ensureLevelScale } from "@/lib/fsm/services/scale";
import { SkillInUseError, createSkill, deleteSkill, listSkills, updateSkill } from "@/lib/fsm/services/skills";
import { connectToProxy, run, sampleCertificate } from "../scripts/fsm/env";

run(async () => {
  await connectToProxy();

  const scale = await ensureLevelScale();
  assert.equal((await ensureLevelScale()).id, scale.id, "the scale is created only once");
  assert.deepEqual(
    scale.levels.map((level) => level.name),
    ["Basic", "Advanced", "Expert"],
  );
  const [basic, advanced, expert] = scale.levels;

  const employees = (await listActivePersons()).filter((person) => person.isTechnician);
  assert.ok(employees.length >= 3, "three active employees exist");

  const name = `Smoke ${Date.now()}`;
  let skill = await createSkill({ name, scaleId: scale.id });

  try {
    assert.equal(skill.description, null);

    skill = await updateSkill(skill.id, { name: `${name} renamed`, description: "test" });
    assert.equal(skill.name, `${name} renamed`);
    assert.equal(skill.scaleId, scale.id, "the skill keeps its scale after a rename");

    await assert.rejects(updateSkill("00000000000000000000000000000000", { name: "x" }), OwnershipError);

    const first = await createAssignment(skill.id, employees[0].id, { levelId: advanced.id, startDate: "2026-01-01", endDate: "2026-12-31" });
    assert.equal(first.level, advanced.level);
    assert.equal(first.endDate, "2026-12-31");

    await updateAssignment(skill.id, first, { levelId: expert.id, startDate: "2026-02-01", endDate: null });
    const updated = (await listAssignments()).find((a) => a.id === first.id);
    assert.ok(updated);
    assert.equal(updated.level, expert.level);
    assert.equal(updated.startDate, "2026-02-01");
    assert.equal(updated.endDate, null, "no end date reads back as null");

    // `first` is now out of date, as if someone else had changed the assignment.
    await assert.rejects(updateAssignment(skill.id, first, { levelId: basic.id, startDate: "2026-03-01", endDate: null }), ConflictError);

    const second = await createAssignment(skill.id, employees[1].id, { levelId: basic.id, startDate: null, endDate: null });
    assert.equal(second.startDate, todayIso(), "an empty start date means today");

    // One good file and one of a type that is not allowed: the good one is still uploaded.
    const file = sampleCertificate("smoke-test.pdf");
    const unchanged = { levelId: updated.levelId, startDate: updated.startDate, endDate: updated.endDate };
    const failures = await saveAssignment(skill.id, employees[0].id, updated, {
      input: unchanged,
      deleteCertificateIds: [],
      uploads: [file, { ...file, fileName: "notes.txt" }, { ...file, fileName: "to-delete.pdf" }],
    });
    assert.equal(failures.length, 1);
    assert.match(failures[0], /notes\.txt/);
    const uploaded = (await listCertificates()).filter((c) => c.assignmentId === first.id);
    assert.deepEqual(uploaded.map((c) => c.fileName).sort(), ["smoke-test.pdf", "to-delete.pdf"]);
    const certificate = uploaded.find((c) => c.fileName === "smoke-test.pdf")!;
    const download = await fetch(certificateUrl(certificate));
    assert.equal((await download.arrayBuffer()).byteLength, file.sizeBytes);

    const toDelete = uploaded.find((c) => c.fileName === "to-delete.pdf")!;
    await saveAssignment(skill.id, employees[0].id, updated, { input: unchanged, deleteCertificateIds: [toDelete.id], uploads: [] });
    assert.equal(await fsmGet("Attachment", toDelete.id), null, "a certificate marked for deletion is deleted on save");

    await assert.rejects(deleteSkill(skill.id), SkillInUseError);

    const matrix = await loadMatrixData();
    assert.ok(matrix.skills.some((s) => s.id === skill.id));
    assert.ok(matrix.assignments.some((a) => a.id === first.id));

    // Retire: assignments valid today end yesterday, later ones are removed, certificates stay.
    // The second assignment started today, so it is removed together with the future one.
    await createAssignment(skill.id, employees[2].id, { levelId: basic.id, startDate: addDays(todayIso(), 10), endDate: null });
    await retireSkill(skill.id);
    const retired = (await listAssignments()).filter((a) => a.skillId === skill.id);
    assert.deepEqual(
      retired.map((a) => [a.id, a.endDate]),
      [[first.id, addDays(todayIso(), -1)]],
    );
    assert.ok(
      (await listCertificates()).some((c) => c.id === certificate.id),
      "retiring keeps the certificate",
    );

    await deleteSkillWithAssignments(skill.id);
    assert.equal(await fsmGet("Attachment", certificate.id), null, "the certificate is deleted with its assignment");
  } catch (error) {
    await deleteSkillWithAssignments(skill.id);
    throw error;
  }

  assert.ok(!(await listSkills()).some((s) => s.id === skill.id), "the throwaway skill is gone");
  console.log("Smoke test passed.");
});
