import { z } from "zod";

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

type TeamRecord = Team & { adminPasswordHash?: string };

const teamRoleSchema = z.enum(["ADMIN", "MEMBER"]);
const jsonValueSchema = z.json();

type TeamRole = z.infer<typeof teamRoleSchema>;

type TeamRoleInput = z.infer<typeof jsonValueSchema> | undefined;

type TeamStatus = "INVITED" | "ADMIN" | "MEMBER" | "PENDING" | "none";

const isTeamRole = (value: TeamRoleInput): value is TeamRole =>
  teamRoleSchema.safeParse(value).success;

type PendingInvitation = {
  expiresAt: string | null;
  id: string;
  inviterName: string;
  memberId: string;
  teamId: string;
  teamName: string;
};

export type { PendingInvitation, Team, TeamGroup, TeamMember, TeamRecord, TeamRole, TeamStatus };

export { isTeamRole };

export type PendingTeamInvitation = {
  createdAt: string;
  email: string;
  expiresAt: string | null;
  id: string;
  memberId: string;
};
