import { teamLabel } from "../team-label";

import { TeamNotification } from "./team-notification";

type Props = { decision: "approved" | "denied"; teamName: string; teamUrl: string };

const JoinRequestDecided = ({ decision, teamName, teamUrl }: Props) => (
  <TeamNotification
    heading={`Join request ${decision}`}
    message={`Your request to join ${teamLabel(teamName)} was ${decision}.`}
    teamUrl={teamUrl}
  />
);

export { JoinRequestDecided };

export default JoinRequestDecided;
