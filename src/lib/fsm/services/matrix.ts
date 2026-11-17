// Everything the matrix needs, in four list calls that run in parallel: persons and
// certificates through the Query API, skills and assignments through the Skill Service.
// The number of calls does not depend on the number of persons or skills.
import { listAssignments } from "./assignments";
import { listCertificates } from "./certificates";
import type { Assignment, Certificate, Person, Skill } from "./model";
import { listActivePersons } from "./persons";
import { listSkills } from "./skills";

export interface MatrixData {
  persons: Person[];
  skills: Skill[];
  assignments: Assignment[];
  certificates: Certificate[];
}

export async function loadMatrixData(): Promise<MatrixData> {
  const [persons, skills, assignments, certificates] = await Promise.all([listActivePersons(), listSkills(), listAssignments(), listCertificates()]);
  return { persons, skills, assignments, certificates };
}
