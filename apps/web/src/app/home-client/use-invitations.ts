"use client";

import { captureException } from "@sentry/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { acceptInvitation, declineInvitation } from "@/lib/actions/invitation-actions";
import { type PendingInvitation, PendingInvitationsResponseSchema } from "@/lib/home-lists";
import { queryKeys } from "@/lib/query-keys";

const withoutInvitation = (
  current: Array<PendingInvitation>,
  invitationId: string,
): Array<PendingInvitation> => current.filter((invitation) => invitation.id !== invitationId);

const useInvitations = () => {
  const queryClient = useQueryClient();
  const [isInvitationPending, startInvitationTransition] = useTransition();

  const {
    data: invitations = [],
    isError: isInvitationsError,
    isLoading: isLoadingInvitations,
    refetch: refetchInvitations,
  } = useQuery<Array<PendingInvitation>>({
    queryFn: async () => {
      const response = await fetch("/api/invitations");

      if (!response.ok) {
        throw new Error("Failed to fetch invitations");
      }

      const data = PendingInvitationsResponseSchema.parse(await response.json());

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
    isInvitationsError,
    isLoadingInvitations,
    refetchInvitations,
  };
};

export { useInvitations };
