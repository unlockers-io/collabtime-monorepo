import { teamLabel } from "../team-label";

import { TeamNotification } from "./team-notification";

type Props = { requesterName: string; teamName: string; teamUrl: string; year: number };

const JoinRequestReceived = ({ requesterName, teamName, teamUrl, year }: Props) => (
  <TeamNotification
    heading="New join request"
    message={`${requesterName} requested to join ${teamLabel(teamName)}.`}
    teamUrl={teamUrl}
    year={year}
  />
);

export { JoinRequestReceived };

export default JoinRequestReceived;
