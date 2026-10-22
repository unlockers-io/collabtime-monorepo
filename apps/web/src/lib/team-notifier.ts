import { prisma } from "@repo/db";

import { getAppUrl } from "./app-url";
import { sendAppEmail } from "./mailer";
import { log } from "./observability";
import { getTeamName } from "./team-meta";
import { createTeamNotifier } from "./team-notifications";

export const teamNotifier = createTeamNotifier({
  appUrl: getAppUrl,
  listTeamAdmins: async (teamId) => {
    const memberships = await prisma.membership.findMany({
      select: { user: { select: { email: true, name: true } } },
      where: { archivedAt: null, role: "ADMIN", teamId },
    });

    return memberships.map((membership) => membership.user);
  },
  readTeamName: getTeamName,
  reportError: log.error,
  sendEmail: sendAppEmail,
});
