import { captureException } from "@sentry/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { NavRole } from "@/components/nav/user-menu";
import { requestToJoin } from "@/lib/actions/join-requests";
import type { TeamMember } from "@/types";

import type { TeamPageViewer } from "../viewer";

type Options = {
  members: Array<TeamMember>;
  teamId: string;
  viewer: TeamPageViewer;
};

const navRoleOf = ({ status, userId }: TeamPageViewer): NavRole => {
  if (status === "ADMIN") {
    return "admin";
  }

  if (status === "MEMBER") {
    return "member";
  }

  return userId === null ? "guest" : "account";
};

const useTeamMembership = ({ members, teamId, viewer }: Options) => {
  const router = useRouter();
  const [isRequestingJoin, setIsRequestingJoin] = useState(false);
  const isAdmin = viewer.status === "ADMIN";
  const isMember = isAdmin || viewer.status === "MEMBER";
  const currentUserId = isMember ? (viewer.userId ?? undefined) : undefined;

  const hasClaimedProfile =
    currentUserId !== undefined && members.some((member) => member.userId === currentUserId);

  const requestJoin = async () => {
    setIsRequestingJoin(true);

    try {
      const result = await requestToJoin(teamId);

      if (result.success) {
        router.refresh();
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
    hasClaimedProfile,
    isAdmin,
    isMember,
    isRequestingJoin,
    navRole: navRoleOf(viewer),
    requestJoin,
  };
};

type TeamMembership = ReturnType<typeof useTeamMembership>;

export { useTeamMembership };

export type { TeamMembership };
