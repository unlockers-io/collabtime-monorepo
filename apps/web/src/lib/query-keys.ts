const queryKeys = {
  invitations: ["my-invitations"] as const,
  myTeams: ["my-teams"] as const,
  team: {
    all: (teamId: string) => ["team", teamId] as const,
    contents: (teamId: string) => ["team", teamId, "contents"] as const,
    invitations: (teamId: string) => ["team", teamId, "invitations"] as const,
    joinRequests: (teamId: string) => ["team", teamId, "join-requests"] as const,
  },
};

export { queryKeys };
