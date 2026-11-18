import { teamLabel } from "../team-label";

import { TeamNotification } from "./team-notification";

type Props = {
  decision: "accepted" | "declined";
  inviteeName: string;
  teamName: string;
  teamUrl: string;
  year: number;
};

const InvitationDecided = ({ decision, inviteeName, teamName, teamUrl, year }: Props) => (
  <TeamNotification
    heading={`Invitation ${decision}`}
    message={`${inviteeName} ${decision} your invitation to ${teamLabel(teamName)}.`}
    teamUrl={teamUrl}
    year={year}
  />
);

export { InvitationDecided };

export default InvitationDecided;
