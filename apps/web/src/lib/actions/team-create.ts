"use server";

import { randomUUID } from "node:crypto";

import { prisma } from "@repo/db";

import { log } from "@/lib/observability";
import { authenticate } from "@/lib/team-auth";

import { membershipUpsert } from "../membership";
import { newTeamMember } from "../team-commands";
import { writeTeam } from "../team-postgres-repository";
import { withTeamTransaction } from "../team-storage";

import { createTeamAction } from "./team-create-core";

const createTeam = createTeamAction({
  authenticate,
  countAdminTeams: (userId) => prisma.membership.count({ where: { role: "ADMIN", userId } }),
  createId: randomUUID,
  createMember: (overrides) => newTeamMember(randomUUID(), overrides),
  now: () => new Date(),
  persistTeam: (userId, team) =>
    withTeamTransaction(team.id, async (transaction) => {
      await transaction.space.create({
        data: { isPrivate: false, ownerId: userId, teamId: team.id },
      });
      await writeTeam(team.id, team, transaction);
      await transaction.membership.upsert(
        membershipUpsert({ role: "ADMIN", teamId: team.id, userId }),
      );
    }),
  reportError: log.error,
});

export { createTeam };
