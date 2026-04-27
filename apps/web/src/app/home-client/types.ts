type MyTeam = {
  archivedAt: string | null;
  memberCount: number;
  role: string;
  spaceId: string | null;
  teamId: string;
  teamName: string;
};

type WorkspaceToDelete = {
  spaceId: string;
  teamName: string;
};

export type { MyTeam, WorkspaceToDelete };
