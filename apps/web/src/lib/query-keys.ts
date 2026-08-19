const queryKeys = {
  invitations: ["my-invitations"] as const,
  myTeams: ["my-teams"] as const,
  teams: {
    all: ["teams"] as const,
    detail: (teamId: string) => ["teams", teamId] as const,
  },
};

export { queryKeys };
