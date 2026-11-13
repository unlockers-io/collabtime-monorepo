"use server";

import { randomUUID } from "node:crypto";

import { log } from "@/lib/observability";
import { authenticate } from "@/lib/team-auth";

import { newTeamMember } from "../team-commands";

import { createTeamAction } from "./team-create-core";

const createTeam = createTeamAction({
  authenticate,
  createId: randomUUID,
  createMember: (overrides) => newTeamMember(randomUUID(), overrides),
  now: () => new Date(),
  reportError: log.error,
});

export { createTeam };
