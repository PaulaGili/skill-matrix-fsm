// App-side shapes, named as in the assignment. FSM names differ:
// Skill = FSM Tag, Assignment = FSM Skill, Certificate = FSM Attachment, Level = FSM Proficiency.

export interface Person {
  id: string;
  displayName: string;
  jobTitle: string | null;
  // A named employee. Every person also exists as an ERPUSER, and a few technical persons have no name.
  isTechnician: boolean;
}

export interface Level {
  id: string;
  name: string;
  level: number; // 1 = lowest
}

export interface LevelScale {
  id: string;
  levels: Level[];
}

export interface Skill {
  id: string;
  fsmName: string; // with the candidate prefix
  name: string; // without it
  description: string | null;
  scaleId: string | null;
}

export interface Assignment {
  id: string;
  skillId: string;
  personId: string;
  startDate: string | null;
  endDate: string | null; // null = no end date
  levelId: string | null;
  levelName: string | null;
  level: number | null;
}

export interface Certificate {
  id: string;
  assignmentId: string;
  fileName: string;
  type: string;
  createdAt: string | null;
}
