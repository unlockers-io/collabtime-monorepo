type TeamGroup = {
  id: string;
  name: string;
  order: number;
};

type TeamMember = {
  id: string;
  name: string;
  title: string;
  timezone: string;
  workingHoursStart: number; // 0-23 in their local timezone
  workingHoursEnd: number; // 0-23 in their local timezone
  groupId?: string; // Optional: undefined = ungrouped
};

type Team = {
  id: string;
  name: string;
  createdAt: string;
  members: TeamMember[];
  groups: TeamGroup[];
};

type TeamRecord = Team & {
  // Stored server-side only; legacy teams may not have these set.
  adminPasswordHash?: string;
  memberPasswordHash?: string;
};

type ServerSession = {
  teamId: string;
  role: "admin" | "member";
  createdAt: number;
};

type TeamRole = "admin" | "member";

export type { ServerSession, Team, TeamGroup, TeamMember, TeamRecord, TeamRole };
