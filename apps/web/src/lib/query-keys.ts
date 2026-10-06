const queryKeys = {
  invitations: ["my-invitations"] as const,
  joinRequests: (teamId: string) => ["join-requests", teamId] as const,
  myTeams: ["my-teams"] as const,
  teamInvitations: (teamId: string) => ["team-invitations", teamId] as const,
  teams: {
    detail: (teamId: string) => ["teams", teamId] as const,
  },
};

const teamMutationKey = (teamId: string) => ["team-mutation", teamId] as const;

export { queryKeys, teamMutationKey };
