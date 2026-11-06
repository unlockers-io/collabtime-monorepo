import { z } from "zod";

import { teamRoleSchema } from "@/types";

const MyTeamSchema = z.object({
  archivedAt: z.string().nullable(),
  memberCount: z.number(),
  role: teamRoleSchema,
  spaceId: z.string().nullable(),
  teamId: z.string(),
  teamName: z.string(),
});

const PendingInvitationSchema = z.object({
  expiresAt: z.string().nullable(),
  id: z.string(),
  inviterName: z.string(),
  teamId: z.string(),
  teamName: z.string(),
});

const MyTeamsResponseSchema = z.object({ teams: z.array(MyTeamSchema) });

const PendingInvitationsResponseSchema = z.object({
  invitations: z.array(PendingInvitationSchema),
});

type MyTeam = z.infer<typeof MyTeamSchema>;

type PendingInvitation = z.infer<typeof PendingInvitationSchema>;

export { MyTeamsResponseSchema, PendingInvitationsResponseSchema };

export type { MyTeam, PendingInvitation };
