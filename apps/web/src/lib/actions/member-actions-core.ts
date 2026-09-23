import type { authorizeTeamAdmin, authorizeTeamMember } from "@/lib/team-auth";
import type { Team, TeamMember, TeamRecord } from "@/types";

import { displayName } from "../display-name";
import { MAX_MEMBERS_PER_TEAM } from "../limits";
import type { claimOrCreateMemberSlot } from "../team-slots";
import { TeamMemberInputSchema, TeamMemberUpdateSchema, TeamNameSchema } from "../validation";

import { checkUuid, sanitizeTeam } from "./helpers";
import type { MutateTeam } from "./helpers";
import type { ActionErrorEvent, ActionResult } from "./types";

type MemberActionDeps = {
  authorizeTeamAdmin: typeof authorizeTeamAdmin;
  authorizeTeamMember: typeof authorizeTeamMember;
  claimOrCreateSlot: typeof claimOrCreateMemberSlot;
  createId: () => string;
  mutateTeam: MutateTeam;
  readTeam: (teamId: string) => Promise<TeamRecord | null>;
  removeMembershipForSlot: (teamId: string, userId: string, callerUserId: string) => Promise<void>;
  reportError: (event: ActionErrorEvent) => void;
  revalidateTeamName: (teamId: string) => void;
  revokeInvitationsForMember: (teamId: string, memberId: string) => Promise<void>;
};

const createMemberActions = (deps: MemberActionDeps) => {
  const addMember = async (
    teamId: string,
    member: Omit<TeamMember, "id" | "order">,
  ): Promise<ActionResult<{ member: TeamMember; team: Team }>> => {
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    const mutationResult = await deps.mutateTeam({
      access: access.data,
      errorContext: "add member",
      mutate: (team, parsed) => {
        if (team.members.length >= MAX_MEMBERS_PER_TEAM) {
          return { error: `A workspace can have up to ${MAX_MEMBERS_PER_TEAM} members`, ok: false };
        }
        const newMember: TeamMember = {
          ...parsed,
          id: deps.createId(),
          order: team.members.length,
        };
        team.members.push(newMember);
        return { ok: true, value: { member: newMember, team: sanitizeTeam(team) } };
      },
      prelude: () => {
        const result = TeamMemberInputSchema.safeParse(member);
        if (!result.success) {
          return { error: result.error.issues[0]?.message ?? "Invalid member data", ok: false };
        }
        return { ok: true, value: result.data };
      },
    });
    return mutationResult;
  };

  const removeMember = async (teamId: string, memberId: string): Promise<ActionResult<Team>> => {
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    const mutationResult = await deps.mutateTeam({
      access: access.data,
      errorContext: "remove member",
      mutate: (team, prepared) => {
        const member = team.members.find((slot) => slot.id === memberId);
        if (!member) {
          return { error: "Member not found", ok: false };
        }
        if (member.userId !== prepared.userId) {
          return {
            error: "This profile changed while removing it. Refresh and try again.",
            ok: false,
          };
        }
        team.members = team.members.filter((slot) => slot.id !== memberId);
        return { ok: true, value: sanitizeTeam(team) };
      },
      prelude: async () => {
        const check = checkUuid(memberId, "member ID");
        if (!check.ok) {
          return check;
        }
        const callerId = access.data.user.id;
        const team = await deps.readTeam(teamId);
        if (team === null) {
          return { error: "Team not found", ok: false };
        }
        const member = team.members.find((slot) => slot.id === memberId);
        if (!member) {
          return { error: "Member not found", ok: false };
        }
        const userId = member.userId;
        await deps.revokeInvitationsForMember(teamId, memberId);
        if (userId !== undefined && userId !== "" && userId !== callerId) {
          await deps.removeMembershipForSlot(teamId, userId, callerId);
        }
        return { ok: true, value: { userId } };
      },
    });
    return mutationResult;
  };

  const updateMember = async (
    teamId: string,
    memberId: string,
    updates: Partial<Omit<TeamMember, "id">>,
  ): Promise<ActionResult<Team>> => {
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    const mutationResult = await deps.mutateTeam({
      access: access.data,
      errorContext: "update member",
      mutate: (team, parsed) => {
        const memberIndex = team.members.findIndex((member) => member.id === memberId);
        if (memberIndex === -1) {
          return { error: "Member not found", ok: false };
        }
        team.members[memberIndex] = { ...team.members[memberIndex], ...parsed };
        return { ok: true, value: sanitizeTeam(team) };
      },
      prelude: () => {
        const idCheck = checkUuid(memberId, "member ID");
        if (!idCheck.ok) {
          return idCheck;
        }
        const result = TeamMemberUpdateSchema.safeParse(updates);
        if (!result.success) {
          return { error: result.error.issues[0]?.message ?? "Invalid update data", ok: false };
        }
        return { ok: true, value: result.data };
      },
    });
    return mutationResult;
  };

  const updateTeamName = async (teamId: string, name: string): Promise<ActionResult<Team>> => {
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    const mutationResult = await deps.mutateTeam({
      access: access.data,
      errorContext: "update team name",
      mutate: (team, parsed) => {
        team.name = parsed;
        return { ok: true, value: sanitizeTeam(team) };
      },
      prelude: () => {
        const parsed = TeamNameSchema.safeParse(name);
        return parsed.success
          ? { ok: true, value: parsed.data }
          : { error: parsed.error.issues[0]?.message ?? "Invalid workspace name", ok: false };
      },
    });
    if (mutationResult.success) {
      deps.revalidateTeamName(teamId);
    }
    return mutationResult;
  };

  const importMembers = async (
    teamId: string,
    members: Array<Omit<TeamMember, "id" | "order">>,
  ): Promise<ActionResult<{ imported: number; members: Array<TeamMember>; team: Team }>> => {
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    const mutationResult = await deps.mutateTeam({
      access: access.data,
      errorContext: "import members",
      mutate: (team, validated) => {
        if (team.members.length + validated.length > MAX_MEMBERS_PER_TEAM) {
          return { error: `A workspace can have up to ${MAX_MEMBERS_PER_TEAM} members`, ok: false };
        }
        const startOrder = team.members.length;
        const ordered = validated.map((member, index) => ({
          ...member,
          order: startOrder + index,
        }));
        team.members.push(...ordered);
        return {
          ok: true,
          value: { imported: ordered.length, members: ordered, team: sanitizeTeam(team) },
        };
      },
      prelude: () => {
        if (!Array.isArray(members) || members.length === 0) {
          return { error: "No members to import", ok: false };
        }
        if (members.length > 100) {
          return { error: "Cannot import more than 100 members at once", ok: false };
        }
        const validated: Array<TeamMember> = [];
        for (const member of members) {
          const result = TeamMemberInputSchema.safeParse(member);
          if (!result.success) {
            const message = result.error.issues[0]?.message ?? "Invalid member data";
            return { error: `Invalid member "${member.name}": ${message}`, ok: false };
          }
          validated.push({ ...result.data, id: deps.createId(), order: 0 });
        }
        return { ok: true, value: validated };
      },
    });
    return mutationResult;
  };

  const updateOwnMember = async (
    teamId: string,
    memberId: string,
    updates: Partial<
      Pick<TeamMember, "name" | "title" | "timezone" | "workingHoursStart" | "workingHoursEnd">
    >,
  ): Promise<ActionResult<Team>> => {
    const access = await deps.authorizeTeamMember(teamId);
    if (!access.success) {
      return access;
    }
    const callerId = access.data.user.id;
    const mutationResult = await deps.mutateTeam({
      access: access.data,
      errorContext: "update own member",
      mutate: (team, parsed) => {
        const memberIndex = team.members.findIndex((member) => member.id === memberId);
        if (memberIndex === -1) {
          return { error: "Member not found", ok: false };
        }
        const member = team.members[memberIndex];
        if (member.userId !== undefined && member.userId !== "" && member.userId !== callerId) {
          return { error: "You can only edit your own member record", ok: false };
        }
        team.members[memberIndex] = { ...member, ...parsed, userId: callerId };
        return { ok: true, value: sanitizeTeam(team, callerId) };
      },
      prelude: () => {
        const idCheck = checkUuid(memberId, "member ID");
        if (!idCheck.ok) {
          return idCheck;
        }
        const result = TeamMemberUpdateSchema.safeParse(updates);
        if (!result.success) {
          return { error: result.error.issues[0]?.message ?? "Invalid update data", ok: false };
        }
        const { groupId: _stripped, ...safe } = result.data;
        return { ok: true, value: safe };
      },
    });
    return mutationResult;
  };

  const createOwnMemberSlot = async (
    teamId: string,
  ): Promise<ActionResult<{ created: boolean; memberId: string }>> => {
    const access = await deps.authorizeTeamMember(teamId);
    if (!access.success) {
      return access;
    }
    const { user } = access.data;
    try {
      const result = await deps.claimOrCreateSlot(teamId, {
        name: displayName(user.name, user.email),
        userId: user.id,
      });
      return result.ok
        ? { data: { created: result.created, memberId: result.memberId }, success: true }
        : { error: result.error, success: false };
    } catch (error) {
      deps.reportError({
        error,
        message: "Failed to add own profile",
        route: "actions/member",
        teamId,
      });
      return { error: "Could not add your profile. Try again.", success: false };
    }
  };

  const reorderMembers = async (
    teamId: string,
    memberIds: Array<string>,
  ): Promise<ActionResult<void>> => {
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    const mutationResult = await deps.mutateTeam({
      access: access.data,
      errorContext: "reorder members",
      mutate: (team) => {
        const existingIds = new Set(team.members.map((member) => member.id));
        const inputIds = new Set(memberIds);
        if (inputIds.size !== existingIds.size || !memberIds.every((id) => existingIds.has(id))) {
          return { error: "Invalid member order", ok: false };
        }
        const memberMap = new Map(team.members.map((member) => [member.id, member]));
        team.members = memberIds.flatMap((id, index) => {
          const member = memberMap.get(id);
          return member ? [{ ...member, order: index }] : [];
        });
        return { ok: true, value: undefined };
      },
      prelude: () => ({ ok: true, value: undefined }),
    });
    return mutationResult;
  };

  return {
    addMember,
    createOwnMemberSlot,
    importMembers,
    removeMember,
    reorderMembers,
    updateMember,
    updateOwnMember,
    updateTeamName,
  };
};

export { createMemberActions };
