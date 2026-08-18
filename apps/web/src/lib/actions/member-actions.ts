"use server";

import { v4 as uuidv4 } from "uuid";

import { log } from "@/lib/observability";
import { requireAuth, requireTeamMember } from "@/lib/team-auth";
import type { Team, TeamMember } from "@/types";

import { TeamMemberInputSchema, TeamMemberUpdateSchema } from "../validation";

import { checkUuid, mutateTeam, sanitizeTeam } from "./helpers";
import type { MutateTeam } from "./helpers";
import type { ActionResult } from "./types";

type MemberActionDeps = {
  createId: () => string;
  mutateTeam: MutateTeam;
  reportError: (event: Record<string, unknown>) => void;
  requireAuth: typeof requireAuth;
  requireTeamMember: typeof requireTeamMember;
};

const createMemberActions = (deps: MemberActionDeps) => {
  const addMember = async (
    teamId: string,
    member: Omit<TeamMember, "id" | "order">,
  ): Promise<ActionResult<{ member: TeamMember; team: Team }>> => {
    return deps.mutateTeam({
      errorContext: "add member",
      mutate: (team, parsed) => {
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
      teamId,
    });
  };

  const removeMember = async (teamId: string, memberId: string): Promise<ActionResult<Team>> => {
    return deps.mutateTeam({
      errorContext: "remove member",
      mutate: (team) => {
        if (!team.members.some((m) => m.id === memberId)) {
          return { error: "Member not found", ok: false };
        }
        team.members = team.members.filter((m) => m.id !== memberId);
        return { ok: true, value: sanitizeTeam(team) };
      },
      prelude: () => checkUuid(memberId, "member ID"),
      teamId,
    });
  };

  const updateMember = async (
    teamId: string,
    memberId: string,
    updates: Partial<Omit<TeamMember, "id">>,
  ): Promise<ActionResult<Team>> => {
    return deps.mutateTeam({
      errorContext: "update member",
      mutate: (team, parsed) => {
        const memberIndex = team.members.findIndex((m) => m.id === memberId);
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
      teamId,
    });
  };

  const updateTeamName = async (teamId: string, name: string): Promise<ActionResult<Team>> => {
    return deps.mutateTeam({
      errorContext: "update team name",
      mutate: (team, parsed) => {
        team.name = parsed;
        return { ok: true, value: sanitizeTeam(team) };
      },
      prelude: () => {
        const trimmed = name.trim().slice(0, 100);
        if (!trimmed) {
          return { error: "Team name cannot be empty", ok: false };
        }
        return { ok: true, value: trimmed };
      },
      teamId,
    });
  };

  const importMembers = async (
    teamId: string,
    members: Array<Omit<TeamMember, "id" | "order">>,
  ): Promise<ActionResult<{ imported: number; members: Array<TeamMember>; team: Team }>> => {
    return deps.mutateTeam({
      errorContext: "import members",
      mutate: (team, validated) => {
        const startOrder = team.members.length;
        const ordered = validated.map((m, i) => ({ ...m, order: startOrder + i }));
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
            const msg = result.error.issues[0]?.message ?? "Invalid member data";
            return { error: `Invalid member "${member.name}": ${msg}`, ok: false };
          }
          validated.push({ ...result.data, id: deps.createId(), order: 0 });
        }
        return { ok: true, value: validated };
      },
      teamId,
    });
  };

  const updateOwnMember = async (
    teamId: string,
    memberId: string,
    updates: Partial<
      Pick<TeamMember, "name" | "title" | "timezone" | "workingHoursStart" | "workingHoursEnd">
    >,
  ): Promise<ActionResult<Team>> => {
    let session: Awaited<ReturnType<typeof requireAuth>>;
    try {
      session = await deps.requireAuth();
    } catch (error) {
      deps.reportError({ error, message: "Failed to update own member", route: "actions/member" });
      return { error: "Failed to update member", success: false };
    }

    return deps.mutateTeam({
      authorize: async (id) => {
        try {
          await deps.requireTeamMember(id);
        } catch {
          return { error: "You are not a member of this team", ok: false };
        }
        return { ok: true, value: undefined };
      },
      errorContext: "update own member",
      mutate: (team, parsed) => {
        const memberIndex = team.members.findIndex((m) => m.id === memberId);
        if (memberIndex === -1) {
          return { error: "Member not found", ok: false };
        }
        const member = team.members[memberIndex];
        if (
          member.userId !== undefined &&
          member.userId !== "" &&
          member.userId !== session.user.id
        ) {
          return { error: "You can only edit your own member record", ok: false };
        }
        team.members[memberIndex] = { ...member, ...parsed, userId: session.user.id };
        return { ok: true, value: sanitizeTeam(team, session.user.id) };
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
      teamId,
    });
  };

  const reorderMembers = async (
    teamId: string,
    memberIds: Array<string>,
  ): Promise<ActionResult<void>> => {
    return deps.mutateTeam({
      errorContext: "reorder members",
      mutate: (team) => {
        const existingIds = new Set(team.members.map((m) => m.id));
        const inputIds = new Set(memberIds);
        if (inputIds.size !== existingIds.size || !memberIds.every((id) => existingIds.has(id))) {
          return { error: "Invalid member order", ok: false };
        }
        const memberMap = new Map(team.members.map((m) => [m.id, m]));
        team.members = memberIds.flatMap((id, index) => {
          const member = memberMap.get(id);
          return member ? [{ ...member, order: index }] : [];
        });
        return { ok: true, value: undefined };
      },
      prelude: () => ({ ok: true, value: undefined }),
      teamId,
    });
  };

  return {
    addMember,
    importMembers,
    removeMember,
    reorderMembers,
    updateMember,
    updateOwnMember,
    updateTeamName,
  };
};

const memberActions = createMemberActions({
  createId: uuidv4,
  mutateTeam,
  reportError: log.error,
  requireAuth,
  requireTeamMember,
});

const {
  addMember,
  importMembers,
  removeMember,
  reorderMembers,
  updateMember,
  updateOwnMember,
  updateTeamName,
} = memberActions;

export {
  addMember,
  createMemberActions,
  importMembers,
  removeMember,
  reorderMembers,
  updateMember,
  updateOwnMember,
  updateTeamName,
};
