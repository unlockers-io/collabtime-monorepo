import type { Team, TeamRecord } from "@/types";

import { isClaimed } from "./team-commands";
import { readTeamRecord } from "./team-store";

// Other people's account ids stay on the server; the client only learns that a slot is taken.
const CLAIMED_BY_SOMEONE_ELSE = "claimed";

const toPublicTeam = (team: TeamRecord, viewerId: string | undefined): Team => {
  const { adminPasswordHash: _, ...publicTeam } = team;

  return {
    ...publicTeam,
    members: publicTeam.members.map(({ userId, ...member }) => {
      if (userId !== undefined && userId === viewerId) {
        return Object.assign(member, { userId });
      }

      return isClaimed({ userId })
        ? Object.assign(member, { userId: CLAIMED_BY_SOMEONE_ELSE })
        : member;
    }),
  };
};

const readPublicTeam = async (
  teamId: string,
  viewerId: string | undefined,
): Promise<Team | null> => {
  const team = await readTeamRecord(teamId);

  return team && toPublicTeam(team, viewerId);
};

export { readPublicTeam, toPublicTeam };
