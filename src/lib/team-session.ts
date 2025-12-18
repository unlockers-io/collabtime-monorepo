"use server";

import { cookies } from "next/headers";
import { deleteSession } from "./actions";

const TEAM_SESSION_PREFIX = "collab-time-session:";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const getTeamSessionKey = (teamId: string) => `${TEAM_SESSION_PREFIX}${teamId}`;

const readTeamSession = async (teamId: string): Promise<string | null> => {
  const cookieStore = await cookies();
  return cookieStore.get(getTeamSessionKey(teamId))?.value ?? null;
};

const writeTeamSession = async (teamId: string, token: string) => {
  if (typeof token !== "string") {
    throw new Error(`writeTeamSession expects a string token, got: ${typeof token}`);
  }
  const cookieStore = await cookies();
  cookieStore.set(getTeamSessionKey(teamId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
};

const clearTeamSession = async (teamId: string) => {
  const cookieStore = await cookies();
  cookieStore.delete(getTeamSessionKey(teamId));
};

const logout = async (teamId: string, token: string) => {
  await deleteSession(token);
  const cookieStore = await cookies();
  cookieStore.delete(getTeamSessionKey(teamId));
};

export { clearTeamSession, logout, readTeamSession, writeTeamSession };
