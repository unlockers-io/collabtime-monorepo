import type { TeamRole } from "@/types";

import type { MembershipStore } from "./membership";

type StoredMembership = { archivedAt: Date | null; role: TeamRole };
type TeamState = { memberships: Map<string, StoredMembership>; revokedSlots: Set<string> };
const createMemoryMembershipStore = () => {
  const teams = new Map<string, TeamState>();
  const locks = new Map<string, Promise<undefined>>();
  const stateFor = (teamId: string): TeamState => {
    let state = teams.get(teamId);
    if (!state) {
      state = { memberships: new Map(), revokedSlots: new Set() };
      teams.set(teamId, state);
    }
    return state;
  };
  const store: MembershipStore<undefined> = {
    grant: ({ role, teamId, userId }) => {
      const state = stateFor(teamId);
      const existing = state.memberships.get(userId);
      state.memberships.set(userId, { archivedAt: null, role: existing?.role ?? role });
      return Promise.resolve();
    },
    lock: async (teamId, run) => {
      const previous = locks.get(teamId);
      const gate = Promise.withResolvers<undefined>();
      locks.set(teamId, gate.promise);
      await previous;
      const before = structuredClone(stateFor(teamId));
      try {
        return await run(undefined);
      } catch (error) {
        teams.set(teamId, before);
        throw error;
      } finally {
        gate.resolve(undefined);
        if (locks.get(teamId) === gate.promise) {
          locks.delete(teamId);
        }
      }
    },
    revoke: ({ memberId, teamId, userId }) => {
      const state = stateFor(teamId);
      state.revokedSlots.add(memberId);
      if (userId !== undefined && state.memberships.get(userId)?.role === "MEMBER") {
        state.memberships.delete(userId);
      }
      return Promise.resolve();
    },
  };
  return {
    ...store,
    invitationsRevoked: (teamId: string, memberId: string): boolean =>
      stateFor(teamId).revokedSlots.has(memberId),
    read: (teamId: string, userId: string): StoredMembership | null =>
      stateFor(teamId).memberships.get(userId) ?? null,
    seed: (teamId: string, userId: string, membership: StoredMembership) => {
      stateFor(teamId).memberships.set(userId, membership);
    },
  };
};
export { createMemoryMembershipStore };
