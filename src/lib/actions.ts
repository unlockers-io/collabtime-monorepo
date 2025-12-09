"use server";

import { v4 as uuidv4 } from "uuid";
import { redis, TEAM_TTL_SECONDS } from "./redis";
import {
  TeamMemberInputSchema,
  TeamMemberUpdateSchema,
  UUIDSchema,
} from "./validation";
import type { Team, TeamMember } from "@/types";

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
      createdAt: new Date().toISOString(),
      members: [],
    };

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_TTL_SECONDS,
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

    return typeof data === "string" ? JSON.parse(data) : data;
  } catch (error) {
    console.error("Failed to get team:", error);
    return null;
  }
};

const addMember = async (
  teamId: string,
  member: Omit<TeamMember, "id">
): Promise<ActionResult<Team>> => {
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

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_TTL_SECONDS,
    });

    return { success: true, data: team };
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

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_TTL_SECONDS,
    });

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

    team.members[memberIndex] = {
      ...team.members[memberIndex],
      ...updateResult.data,
    };

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_TTL_SECONDS,
    });

    return { success: true, data: team };
  } catch (error) {
    console.error("Failed to update member:", error);
    return { success: false, error: "Failed to update member" };
  }
};

export { createTeam, getTeam, addMember, removeMember, updateMember };
