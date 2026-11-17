import { teamLabel } from "../team-label";

import { TeamNotification } from "./team-notification";

type Props = { decision: "approved" | "denied"; teamName: string; teamUrl: string; year: number };

const JoinRequestDecided = ({ decision, teamName, teamUrl, year }: Props) => (
  <TeamNotification
    heading={`Join request ${decision}`}
    message={`Your request to join ${teamLabel(teamName)} was ${decision}.`}
    teamUrl={teamUrl}
    year={year}
  />
);

export { JoinRequestDecided };

export default JoinRequestDecided;
