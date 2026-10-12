import type { TeamRole } from "@/types";

import type { MembershipStore } from "./membership";

type StoredMembership = { archivedAt: Date | null; role: TeamRole };

const key = (teamId: string, id: string): string => `${teamId}:${id}`;

const createMemoryMembershipStore = () => {
  const memberships = new Map<string, StoredMembership>();
  const revokedSlots = new Set<string>();
  const locks = new Map<string, Promise<undefined>>();

  const store: MembershipStore<undefined> = {
    find: (teamId, userId) => Promise.resolve(memberships.get(key(teamId, userId)) ?? null),
    grant: ({ role, teamId, userId }) => {
      const existing = memberships.get(key(teamId, userId));
      memberships.set(key(teamId, userId), { archivedAt: null, role: existing?.role ?? role });
      return Promise.resolve();
    },
    lock: async (teamId, run) => {
      const previous = locks.get(teamId);
      const gate = Promise.withResolvers<undefined>();
      locks.set(teamId, gate.promise);
      await previous;
      const prefix = `${teamId}:`;
      const before = new Map([...memberships].filter(([id]) => id.startsWith(prefix)));
      const revokedBefore = new Set([...revokedSlots].filter((id) => id.startsWith(prefix)));
      try {
        return await run(undefined);
      } catch (error) {
        for (const id of memberships.keys()) {
          if (id.startsWith(prefix)) {
            memberships.delete(id);
          }
        }
        for (const [id, value] of before) {
          memberships.set(id, value);
        }
        for (const id of revokedSlots) {
          if (id.startsWith(prefix)) {
            revokedSlots.delete(id);
          }
        }
        for (const id of revokedBefore) {
          revokedSlots.add(id);
        }
        throw error;
      } finally {
        gate.resolve(undefined);
        if (locks.get(teamId) === gate.promise) {
          locks.delete(teamId);
        }
      }
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
