import { teamLabel } from "../team-label";

import { TeamNotification } from "./team-notification";

type Props = {
  decision: "accepted" | "declined";
  inviteeName: string;
  teamName: string;
  teamUrl: string;
};

const InvitationDecided = ({ decision, inviteeName, teamName, teamUrl }: Props) => (
  <TeamNotification
    heading={`Invitation ${decision}`}
    message={`${inviteeName} ${decision} your invitation to ${teamLabel(teamName)}.`}
    teamUrl={teamUrl}
  />
);

export { InvitationDecided };

export default InvitationDecided;
