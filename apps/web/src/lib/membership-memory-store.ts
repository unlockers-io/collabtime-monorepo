import type { TeamRole } from "@/types";

import type { MembershipStore } from "./membership";

type StoredMembership = { archivedAt: Date | null; role: TeamRole };

const key = (teamId: string, id: string): string => `${teamId}:${id}`;

const createMemoryMembershipStore = () => {
  const memberships = new Map<string, StoredMembership>();
  const revokedSlots = new Set<string>();

  const store: MembershipStore = {
    grant: ({ role, teamId, userId }) => {
      const existing = memberships.get(key(teamId, userId));
      memberships.set(key(teamId, userId), { archivedAt: null, role: existing?.role ?? role });
      return Promise.resolve();
    },
    revoke: ({ memberId, teamId, userId }) => {
      revokedSlots.add(key(teamId, memberId));
      if (userId !== undefined && memberships.get(key(teamId, userId))?.role === "MEMBER") {
        memberships.delete(key(teamId, userId));
      }
      return Promise.resolve();
    },
  };

  return {
    ...store,
    invitationsRevoked: (teamId: string, memberId: string): boolean =>
      revokedSlots.has(key(teamId, memberId)),
    read: (teamId: string, userId: string): StoredMembership | null =>
      memberships.get(key(teamId, userId)) ?? null,
    seed: (teamId: string, userId: string, membership: StoredMembership) => {
      memberships.set(key(teamId, userId), membership);
    },
  };
};

export { createMemoryMembershipStore };
