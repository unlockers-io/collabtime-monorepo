import type { authorizeTeamAdmin, authorizeTeamMember } from "@/lib/team-auth";
import type { Team, TeamMember } from "@/types";

import { displayName } from "../display-name";
import type { RevokeMembership } from "../membership";
import { teamCommands } from "../team-commands";
import { TeamMemberInputSchema, TeamMemberUpdateSchema, TeamNameSchema } from "../validation";

import { invalidUuid, parsedInput, sanitizedTeam, sanitizeTeam } from "./helpers";
import type { MutateTeam } from "./helpers";
import type { ActionErrorEvent, ActionResult } from "./types";

type MemberActionDeps = {
  authorizeTeamAdmin: typeof authorizeTeamAdmin;
  authorizeTeamMember: typeof authorizeTeamMember;
  mutateTeam: MutateTeam;
  reportError: (event: ActionErrorEvent) => void;
  revokeMembership: RevokeMembership;
};

const MAX_IMPORT_BATCH = 100;

const createMemberActions = (deps: MemberActionDeps) => {
  const addMember = async (
    teamId: string,
    member: Omit<TeamMember, "id" | "order">,
  ): Promise<ActionResult<{ member: TeamMember; team: Team }>> => {
    const access = await deps.authorizeTeamAdmin(teamId);

    if (!access.success) {
      return access;
    }

    const parsed = parsedInput(TeamMemberInputSchema.safeParse(member), "Invalid member data");

    if (!parsed.success) {
      return parsed;
    }

    const added = await deps.mutateTeam({
      access: access.data,
      command: teamCommands.addMember(parsed.data),
      errorContext: "add member",
    });

    return added.success
      ? { data: { member: added.data.value, team: sanitizeTeam(added.data.team) }, success: true }
      : added;
  };

  const removeMember = async (teamId: string, memberId: string): Promise<ActionResult<Team>> => {
    const access = await deps.authorizeTeamAdmin(teamId);

    if (!access.success) {
      return access;
    }

    const invalid = invalidUuid(memberId, "member ID");

    if (invalid) {
      return invalid;
    }

    try {
      const revoked = await deps.revokeMembership({ access: access.data, memberId });

      if (!revoked.ok) {
        const failed =
          revoked.reason === "write-failed" ? "Failed to remove member" : revoked.error;

        return { error: failed, success: false };
      }

      return { data: sanitizeTeam(revoked.team), success: true };
    } catch (error) {
      deps.reportError({
        error,
        memberId,
        message: "Failed to remove member",
        route: "actions/member",
        teamId,
      });

      return { error: "Failed to remove member", success: false };
    }
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

    const invalid = invalidUuid(memberId, "member ID");

    if (invalid) {
      return invalid;
    }

    const parsed = parsedInput(TeamMemberUpdateSchema.safeParse(updates), "Invalid update data");

    if (!parsed.success) {
      return parsed;
    }

    return sanitizedTeam(
      await deps.mutateTeam({
        access: access.data,
        command: teamCommands.updateMember(memberId, parsed.data),
        errorContext: "update member",
      }),
    );
  };

  const updateTeamName = async (teamId: string, name: string): Promise<ActionResult<Team>> => {
    const access = await deps.authorizeTeamAdmin(teamId);

    if (!access.success) {
      return access;
    }

    const parsed = parsedInput(TeamNameSchema.safeParse(name), "Invalid workspace name");

    if (!parsed.success) {
      return parsed;
    }

    return sanitizedTeam(
      await deps.mutateTeam({
        access: access.data,
        command: teamCommands.renameTeam(parsed.data),
        errorContext: "update team name",
      }),
    );
  };

  const importMembers = async (
    teamId: string,
    members: Array<Omit<TeamMember, "id" | "order">>,
  ): Promise<ActionResult<{ imported: number; members: Array<TeamMember>; team: Team }>> => {
    const access = await deps.authorizeTeamAdmin(teamId);

    if (!access.success) {
      return access;
    }

    if (!Array.isArray(members) || members.length === 0) {
      return { error: "No members to import", success: false };
    }

    if (members.length > MAX_IMPORT_BATCH) {
      return {
        error: `Cannot import more than ${MAX_IMPORT_BATCH} members at once`,
        success: false,
      };
    }

    const validated = [];

    for (const member of members) {
      const result = TeamMemberInputSchema.safeParse(member);

      if (!result.success) {
        const message = result.error.issues[0]?.message ?? "Invalid member data";

        return { error: `Invalid member "${member.name}": ${message}`, success: false };
      }

      validated.push(result.data);
    }

    const imported = await deps.mutateTeam({
      access: access.data,
      command: teamCommands.importMembers(validated),
      errorContext: "import members",
    });

    if (!imported.success) {
      return imported;
    }

    const { team, value } = imported.data;

    return {
      data: { imported: value.length, members: value, team: sanitizeTeam(team) },
      success: true,
    };
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

    const invalid = invalidUuid(memberId, "member ID");

    if (invalid) {
      return invalid;
    }

    const parsed = parsedInput(TeamMemberUpdateSchema.safeParse(updates), "Invalid update data");

    if (!parsed.success) {
      return parsed;
    }

    const { groupId: _stripped, ...safe } = parsed.data;
    const callerId = access.data.user.id;

    return sanitizedTeam(
      await deps.mutateTeam({
        access: access.data,
        command: teamCommands.updateOwnMember(memberId, callerId, safe),
        errorContext: "update own member",
      }),
      callerId,
    );
  };

  const createOwnMemberSlot = async (
    teamId: string,
  ): Promise<ActionResult<{ created: boolean; memberId: string }>> => {
    const access = await deps.authorizeTeamMember(teamId);

    if (!access.success) {
      return access;
    }

    const { user } = access.data;

    const claimed = await deps.mutateTeam({
      access: access.data,
      command: teamCommands.claimMemberSlot({
        name: displayName(user.name, user.email),
        userId: user.id,
      }),
      errorContext: "add your profile",
    });

    if (!claimed.success) {
      return claimed;
    }

    const { created, memberId } = claimed.data.value;

    return { data: { created, memberId }, success: true };
  };

  const reorderMembers = async (
    teamId: string,
    memberIds: Array<string>,
  ): Promise<ActionResult<void>> => {
    const access = await deps.authorizeTeamAdmin(teamId);

    if (!access.success) {
      return access;
    }

    const reordered = await deps.mutateTeam({
      access: access.data,
      command: teamCommands.reorderMembers(memberIds),
      errorContext: "reorder members",
    });

    return reordered.success ? { data: undefined, success: true } : reordered;
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
