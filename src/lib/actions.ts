"use server";

import { v4 as uuidv4 } from "uuid";
import { redis, TEAM_INITIAL_TTL_SECONDS, TEAM_ACTIVE_TTL_SECONDS } from "./redis";
import { realtime } from "./realtime";
import {
  TeamMemberInputSchema,
  TeamMemberUpdateSchema,
  UUIDSchema,
} from "./validation";
import type { Team, TeamMember } from "@/types";
import z from "zod";

type ActionResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

const createTeam = async (): Promise<ActionResult<string>> => {
  try {
    const teamId = uuidv4();
    const team: Team = {
      id: teamId,
      name: "",
      createdAt: new Date().toISOString(),
      members: [],
    };

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_INITIAL_TTL_SECONDS,
    });

    return { success: true, data: teamId };
  } catch (error) {
    console.error("Failed to create team:", error);
    return { success: false, error: "Failed to create team" };
  }
};

const getTeam = async (teamId: string): Promise<Team | null> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return null;
    }

    const data = await redis.get<string>(`team:${teamId}`);

    if (!data) {
      return null;
    }

    const team = typeof data === "string" ? JSON.parse(data) : data;

    // Ensure backwards compatibility for teams without name field
    if (team.name === undefined) {
      team.name = "";
    }

    return team;
  } catch (error) {
    console.error("Failed to get team:", error);
    return null;
  }
};

const addMember = async (
  teamId: string,
  member: Omit<TeamMember, "id">
): Promise<ActionResult<{ team: Team; member: TeamMember }>> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const memberResult = TeamMemberInputSchema.safeParse(member);
    if (!memberResult.success) {
      const errorMessage = memberResult.error.issues[0]?.message ?? "Invalid member data";
      return { success: false, error: errorMessage };
    }

    const team = await getTeam(teamId);

    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const newMember: TeamMember = {
      ...memberResult.data,
      id: uuidv4(),
    };

    team.members.push(newMember);

    // Use longer TTL when members are added (2 years)
    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    // Emit realtime event to team channel
    await realtime.channel(`team-${teamId}`).emit("team.memberAdded", newMember);

    return { success: true, data: { team, member: newMember } };
  } catch (error) {
    console.error("Failed to add member:", error);
    return { success: false, error: "Failed to add member" };
  }
};

const removeMember = async (
  teamId: string,
  memberId: string
): Promise<ActionResult<Team>> => {
  try {
    const teamUuidResult = UUIDSchema.safeParse(teamId);
    const memberUuidResult = UUIDSchema.safeParse(memberId);

    if (!teamUuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }
    if (!memberUuidResult.success) {
      return { success: false, error: "Invalid member ID" };
    }

    const team = await getTeam(teamId);

    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const memberExists = team.members.some((m) => m.id === memberId);
    if (!memberExists) {
      return { success: false, error: "Member not found" };
    }

    team.members = team.members.filter((m) => m.id !== memberId);

    // Keep the active TTL since team has activity
    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    // Emit realtime event to team channel
    await realtime.channel(`team-${teamId}`).emit("team.memberRemoved", { memberId });

    return { success: true, data: team };
  } catch (error) {
    console.error("Failed to remove member:", error);
    return { success: false, error: "Failed to remove member" };
  }
};

const updateMember = async (
  teamId: string,
  memberId: string,
  updates: Partial<Omit<TeamMember, "id">>
): Promise<ActionResult<Team>> => {
  try {
    const teamUuidResult = UUIDSchema.safeParse(teamId);
    const memberUuidResult = UUIDSchema.safeParse(memberId);

    if (!teamUuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }
    if (!memberUuidResult.success) {
      return { success: false, error: "Invalid member ID" };
    }

    const updateResult = TeamMemberUpdateSchema.safeParse(updates);
    if (!updateResult.success) {
      const errorMessage = updateResult.error.issues[0]?.message ?? "Invalid update data";
      return { success: false, error: errorMessage };
    }

    const team = await getTeam(teamId);

    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const memberIndex = team.members.findIndex((m) => m.id === memberId);

    if (memberIndex === -1) {
      return { success: false, error: "Member not found" };
    }

    const updatedMember = {
      ...team.members[memberIndex],
      ...updateResult.data,
    };

    team.members[memberIndex] = updatedMember;

    // Keep the active TTL since team has activity
    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    // Emit realtime event to team channel
    await realtime.channel(`team-${teamId}`).emit("team.memberUpdated", updatedMember);

    return { success: true, data: team };
  } catch (error) {
    console.error("Failed to update member:", error);
    return { success: false, error: "Failed to update member" };
  }
};

const reorderMembers = async (
  teamId: string,
  orderedIds: string[]
): Promise<ActionResult<Team>> => {
  try {
    const teamUuidResult = UUIDSchema.safeParse(teamId);
    if (!teamUuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const idsResult = z.array(UUIDSchema).safeParse(orderedIds);
    if (!idsResult.success) {
      return { success: false, error: "Invalid member IDs" };
    }

    const team = await getTeam(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    // Ensure provided IDs match the existing member set
    const existingIds = new Set(team.members.map((m) => m.id));
    const providedIds = new Set(orderedIds);
    if (existingIds.size !== providedIds.size) {
      return { success: false, error: "Member list mismatch" };
    }
    for (const id of existingIds) {
      if (!providedIds.has(id)) {
        return { success: false, error: "Member list mismatch" };
      }
    }

    // Reorder members to match the provided order
    const memberMap = new Map(team.members.map((m) => [m.id, m]));
    team.members = orderedIds.map((id) => memberMap.get(id)!);

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    await realtime.channel(`team-${teamId}`).emit("team.membersReordered", {
      order: orderedIds,
    });

    return { success: true, data: team };
  } catch (error) {
    console.error("Failed to reorder members:", error);
    return { success: false, error: "Failed to reorder members" };
  }
};

const updateTeamName = async (
  teamId: string,
  name: string
): Promise<ActionResult<Team>> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const trimmedName = name.trim().slice(0, 100);

    const team = await getTeam(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    team.name = trimmedName;

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    await realtime.channel(`team-${teamId}`).emit("team.nameUpdated", {
      name: trimmedName,
    });

    return { success: true, data: team };
  } catch (error) {
    console.error("Failed to update team name:", error);
    return { success: false, error: "Failed to update team name" };
  }
};

const validateTeam = async (teamId: string): Promise<boolean> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return false;
    }

    const exists = await redis.exists(`team:${teamId}`);
    return exists === 1;
  } catch (error) {
    console.error("Failed to validate team:", error);
    return false;
  }
};

export {
  createTeam,
  getTeam,
  addMember,
  removeMember,
  updateMember,
  reorderMembers,
  updateTeamName,
  validateTeam,
};
