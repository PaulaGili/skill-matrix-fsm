// npm run cleanup: lists everything in our namespace. With "-- --yes" it deletes it:
// certificates, assignments, skills, then the scale. FSM refuses any other order.
import { listAssignments } from "@/lib/fsm/services/assignments";
import { listCertificates } from "@/lib/fsm/services/certificates";
import { removeAssignments } from "@/lib/fsm/services/remove";
import { deleteScale, findOwnScales } from "@/lib/fsm/services/scale";
import { deleteSkill, listSkills } from "@/lib/fsm/services/skills";
import { connectToProxy, run } from "./env";

run(async () => {
  await connectToProxy();
  const [skills, assignments, certificates, scales] = await Promise.all([listSkills(), listAssignments(), listCertificates(), findOwnScales()]);

  console.log(`Found ${skills.length} skills, ${assignments.length} assignments, ${certificates.length} certificates, ${scales.length} scales.`);
  for (const skill of skills) console.log(`  ${skill.fsmName}`);
  for (const scale of scales) console.log(`  ${scale.name}`);

  if (!process.argv.includes("--yes")) {
    console.log('Nothing deleted. Run "npm run cleanup -- --yes" to delete.');
    return;
  }

  for (const skill of skills) {
    const ids = assignments.filter((a) => a.skillId === skill.id).map((a) => a.id);
    await removeAssignments(skill.id, ids);
    await deleteSkill(skill.id);
  }
  for (const scale of scales) await deleteScale(scale);
  console.log("Cleanup done.");
});
