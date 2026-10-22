import { teamLabel } from "../team-label";

import { TeamNotification } from "./team-notification";

type Props = { requesterName: string; teamName: string; teamUrl: string };

const JoinRequestReceived = ({ requesterName, teamName, teamUrl }: Props) => (
  <TeamNotification
    heading="New join request"
    message={`${requesterName} requested to join ${teamLabel(teamName)}.`}
    teamUrl={teamUrl}
  />
);

export { JoinRequestReceived };

export default JoinRequestReceived;
