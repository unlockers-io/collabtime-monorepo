type TeamGroup = {
  id: string;
  name: string;
  order: number;
};

type TeamMember = {
  groupId?: string;
  id: string;
  name: string;
  order: number;
  timezone: string;
  title: string;
  userId?: string;
  workingHoursEnd: number;
  workingHoursStart: number;
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

type TeamRole = "ADMIN" | "MEMBER";

type TeamStatus = "ADMIN" | "MEMBER" | "PENDING" | "none";

const TEAM_ROLES = new Set<string>(["ADMIN", "MEMBER"]);

const isTeamRole = (value: unknown): value is TeamRole => {
  return typeof value === "string" && TEAM_ROLES.has(value);
};

type PendingInvitation = {
  id: string;
  inviterName: string;
  memberId: string;
  teamId: string;
  teamName: string;
};

export type { PendingInvitation, Team, TeamGroup, TeamMember, TeamRecord, TeamRole, TeamStatus };
export { isTeamRole };
