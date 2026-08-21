"use client";

import { toast } from "@repo/ui/components/sonner";
import { captureException } from "@sentry/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimistic, useTransition } from "react";
import { z } from "zod";

import { acceptInvitation, declineInvitation } from "@/lib/actions/invitation-actions";
import { queryKeys } from "@/lib/query-keys";
import type { PendingInvitation } from "@/types";

const InvitationSchema = z.object({
  id: z.string(),
  inviterName: z.string(),
  memberId: z.string(),
  teamId: z.string(),
  teamName: z.string(),
});

const InvitationsResponseSchema = z.object({ invitations: z.array(InvitationSchema) });

const withoutInvitation = (
  current: Array<PendingInvitation>,
  invitationId: string,
): Array<PendingInvitation> => current.filter((invitation) => invitation.id !== invitationId);

const useInvitations = () => {
  const queryClient = useQueryClient();
  const [isInvitationPending, startInvitationTransition] = useTransition();

  const { data: invitations = [] } = useQuery<Array<PendingInvitation>>({
    queryFn: async () => {
      const response = await fetch("/api/invitations");
      if (!response.ok) {
        throw new Error("Failed to fetch invitations");
      }
      const data = InvitationsResponseSchema.parse(await response.json());
      return data.invitations;
    },
    queryKey: queryKeys.invitations,
  });

  const [optimisticInvitations, removeOptimisticInvitation] = useOptimistic(
    invitations,
    withoutInvitation,
  );

  const handleAcceptInvitation = (invitation: PendingInvitation) => {
    startInvitationTransition(async () => {
      removeOptimisticInvitation(invitation.id);

      try {
        const result = await acceptInvitation(invitation.id);
        if (result.success) {
          toast.success(`Joined ${invitation.teamName}`);
        } else {
          toast.error(result.error);
        }
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: queryKeys.invitations }),
          queryClient.invalidateQueries({ queryKey: queryKeys.myTeams }),
        ]);
      } catch (error) {
        captureException(error);
        toast.error("Failed to accept invitation");
      }
    });
  };

  const handleDeclineInvitation = (invitation: PendingInvitation) => {
    startInvitationTransition(async () => {
      removeOptimisticInvitation(invitation.id);

      try {
        const result = await declineInvitation(invitation.id);
        if (result.success) {
          toast.success("Invitation declined");
          await queryClient.invalidateQueries({ queryKey: queryKeys.invitations });
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        captureException(error);
        toast.error("Failed to decline invitation");
      }
    });
  };

  return {
    handleAcceptInvitation,
    handleDeclineInvitation,
    invitations: optimisticInvitations,
    isInvitationPending,
  };
};

export { useInvitations };
