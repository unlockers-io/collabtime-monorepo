import { captureException } from "@sentry/nextjs";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { requestToJoin } from "@/lib/actions/join-requests";
import { getTeamMembershipRole } from "@/lib/actions/team-read";
import type { TeamMember, TeamStatus } from "@/types";

type Options = {
  initialStatus: TeamStatus;
  members: Array<TeamMember>;
  teamId: string;
  userId: string | undefined;
};

const useTeamMembership = ({ initialStatus, members, teamId, userId }: Options) => {
  const [statusOverride, setStatusOverride] = useState<TeamStatus | null>(null);
  const [isRequestingJoin, setIsRequestingJoin] = useState(false);
  const { data: resolvedRole, error: resolvedRoleError } = useQuery({
    enabled: initialStatus === "none" && Boolean(userId),
    queryFn: () => getTeamMembershipRole(teamId),
    queryKey: ["membership-role", teamId, userId],
  });
  const serverStatus: TeamStatus =
    initialStatus === "none" ? (resolvedRole ?? "none") : initialStatus;
  const teamStatus = statusOverride ?? serverStatus;
  const isAdmin = teamStatus === "ADMIN";
  const isMember = isAdmin || teamStatus === "MEMBER";
  const currentUserId = isMember ? userId : undefined;
  const hasClaimedProfile =
    currentUserId !== undefined &&
    currentUserId !== "" &&
    members.some((member) => member.userId === currentUserId);

  useEffect(() => {
    if (resolvedRoleError) {
      captureException(resolvedRoleError);
    }
  }, [resolvedRoleError]);

  const handleRequestJoin = async () => {
    setIsRequestingJoin(true);
    try {
      const result = await requestToJoin(teamId);
      if (result.success) {
        setStatusOverride("PENDING");
        toast.success("Join request sent! The team admin will review it.");
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      captureException(error);
      toast.error("Failed to send join request");
    }
    setIsRequestingJoin(false);
  };

  return {
    currentUserId,
    handleRequestJoin,
    hasClaimedProfile,
    isAdmin,
    isMember,
    isRequestingJoin,
    teamStatus,
  };
};

export { useTeamMembership };
