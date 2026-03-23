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
  userId?: string; // Links to authenticated user; undefined for manually-added members
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

type TeamStatus = "admin" | "member" | "pending" | "none";

const TEAM_ROLES = new Set<string>(["admin", "member"]);

const isTeamRole = (value: unknown): value is TeamRole => {
  return typeof value === "string" && TEAM_ROLES.has(value);
};

export type { ServerSession, Team, TeamGroup, TeamMember, TeamRecord, TeamRole, TeamStatus };
export { isTeamRole };
