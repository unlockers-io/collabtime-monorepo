type TeamGroup = {
  id: string;
  name: string;
  order: number;
};

type TeamMember = {
  groupId?: string; // Optional: undefined = ungrouped
  id: string;
  name: string;
  timezone: string;
  title: string;
  workingHoursEnd: number; // 0-23 in their local timezone
  workingHoursStart: number; // 0-23 in their local timezone
};

type Team = {
  createdAt: string;
  groups: Array<TeamGroup>;
  id: string;
  members: Array<TeamMember>;
  name: string;
};

type TeamRecord = Team & {
  // Stored server-side only; legacy teams may not have this set.
  adminPasswordHash?: string;
};

type ServerSession = {
  createdAt: number;
  role: "admin" | "member";
  teamId: string;
};

type TeamRole = "admin" | "member";

export type { ServerSession, Team, TeamGroup, TeamMember, TeamRecord, TeamRole };
