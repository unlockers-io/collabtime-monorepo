type TeamGroup = {
  id: string;
  name: string;
  order: number;
};

type TeamMember = {
  groupId?: string; // Optional: undefined = ungrouped
  id: string;
  name: string;
  order: number;
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
  role: "ADMIN" | "MEMBER";
  teamId: string;
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

export type {
  PendingInvitation,
  ServerSession,
  Team,
  TeamGroup,
  TeamMember,
  TeamRecord,
  TeamRole,
  TeamStatus,
};
export { isTeamRole };
