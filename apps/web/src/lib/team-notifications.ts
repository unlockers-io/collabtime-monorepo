import type { TransactionalEmail } from "@repo/transactional";

import type { ActionErrorEvent } from "./actions/types";
import { displayName } from "./display-name";

type Person = { email: string; name: string | null };

type NotifierDeps = {
  appUrl: () => string;
  listTeamAdmins: (teamId: string) => Promise<Array<Person>>;
  readTeamName: (teamId: string) => Promise<string | null>;
  reportError: (event: ActionErrorEvent) => void;
  sendEmail: (email: TransactionalEmail) => Promise<{ sent: boolean }>;
};

export const createTeamNotifier = (deps: NotifierDeps) => {
  const notify = async (
    teamId: string,
    build: (context: {
      teamId: string;
      teamName: string;
      teamUrl: string;
    }) => Array<TransactionalEmail> | Promise<Array<TransactionalEmail>>,
  ) => {
    try {
      const teamName = (await deps.readTeamName(teamId)) ?? "";

      const emails = await build({
        teamId,
        teamName,
        teamUrl: new URL(`/${teamId}`, deps.appUrl()).toString(),
      });

      const outcomes = await Promise.allSettled(emails.map((email) => deps.sendEmail(email)));

      for (const outcome of outcomes) {
        if (outcome.status === "rejected") {
          deps.reportError({
            error: outcome.reason,
            message: "Failed to send team notification",
            route: "lib/team-notifications",
            teamId,
          });
        }
      }
    } catch (error) {
      deps.reportError({
        error,
        message: "Failed to notify team",
        route: "lib/team-notifications",
        teamId,
      });
    }
  };

  return {
    notifyAdminsOfJoinRequest: (teamId: string, requester: Person) =>
      notify(teamId, async (context) => {
        const admins = await deps.listTeamAdmins(teamId);

        return admins.map((admin) => ({
          recipientEmail: admin.email,
          requesterName: displayName(requester.name, requester.email),
          teamId: context.teamId,
          teamName: context.teamName,
          teamUrl: context.teamUrl,
          type: "join-request-received" as const,
        }));
      }),
    notifyInviterOfDecision: (
      invitation: { invitedBy: Person; teamId: string },
      user: Person,
      decision: "accepted" | "declined",
    ) =>
      notify(invitation.teamId, (context) => [
        {
          ...context,
          decision,
          inviteeName: displayName(user.name, user.email),
          recipientEmail: invitation.invitedBy.email,
          type: "invitation-decided",
        },
      ]),
    notifyRequesterOfDecision: (
      request: { teamId: string; user: Person },
      decision: "approved" | "denied",
    ) =>
      notify(request.teamId, (context) => [
        { ...context, decision, recipientEmail: request.user.email, type: "join-request-decided" },
      ]),
  };
};
