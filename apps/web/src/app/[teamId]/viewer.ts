import type { Viewer } from "@/lib/workspace-access";

/** What the team page's client knows about who is looking at it. */
type TeamPageViewer = Pick<Viewer, "invitation" | "inviteMismatch" | "isArchived" | "status"> & {
  userId: string | null;
};

type TeamPageOwner = { hasPassword: boolean; spaceId: string };

export type { TeamPageOwner, TeamPageViewer };
