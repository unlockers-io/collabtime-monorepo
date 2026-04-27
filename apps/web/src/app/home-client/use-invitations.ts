"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { acceptInvitation, declineInvitation } from "@/lib/actions/invitation-actions";
import type { PendingInvitation } from "@/types";

const useInvitations = (isAuthenticated: boolean) => {
  const queryClient = useQueryClient();
  const [processingInvitations, setProcessingInvitations] = useState<Set<string>>(new Set());

  const { data: invitations = [] } = useQuery<Array<PendingInvitation>>({
    enabled: isAuthenticated,
    queryFn: async () => {
      const response = await fetch("/api/invitations");
      if (!response.ok) {
        throw new Error("Failed to fetch invitations");
      }
      const data = (await response.json()) as { invitations: Array<PendingInvitation> };
      return data.invitations;
    },
    queryKey: ["my-invitations"],
  });

  const handleAcceptInvitation = async (invitation: PendingInvitation) => {
    setProcessingInvitations((prev) => new Set(prev).add(invitation.id));
    try {
      const result = await acceptInvitation(invitation.id);
      if (result.success) {
        toast.success(`Joined ${invitation.teamName}`);
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: ["my-invitations"] }),
          queryClient.invalidateQueries({ queryKey: ["my-teams"] }),
        ]);
      } else {
        toast.error(result.error);
      }
    } finally {
      setProcessingInvitations((prev) => {
        const next = new Set(prev);
        next.delete(invitation.id);
        return next;
      });
    }
  };

  const handleDeclineInvitation = async (invitation: PendingInvitation) => {
    setProcessingInvitations((prev) => new Set(prev).add(invitation.id));
    try {
      const result = await declineInvitation(invitation.id);
      if (result.success) {
        toast.success("Invitation declined");
        await queryClient.invalidateQueries({ queryKey: ["my-invitations"] });
      } else {
        toast.error(result.error);
      }
    } finally {
      setProcessingInvitations((prev) => {
        const next = new Set(prev);
        next.delete(invitation.id);
        return next;
      });
    }
  };

  return {
    handleAcceptInvitation,
    handleDeclineInvitation,
    invitations,
    processingInvitations,
  };
};

export { useInvitations };
