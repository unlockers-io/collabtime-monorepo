import { type InvitationStore, isInvitationOpen, type StoredInvitation } from "./invitations";
import type { MembershipStore } from "./membership";

const newestFirst = (left: StoredInvitation, right: StoredInvitation): number =>
  right.createdAt.getTime() - left.createdAt.getTime();

const sameVersion = (left: StoredInvitation, right: StoredInvitation): boolean =>
  left.status === right.status && left.updatedAt.getTime() === right.updatedAt.getTime();

const createMemoryInvitationStore = (grantMembership: MembershipStore["grant"]) => {
  const invitations = new Map<string, StoredInvitation>();
  let created = 0;
  let clock = 0;

  // Every write moves `updatedAt` forward, even within one millisecond, so versions never repeat.
  const stamp = (): Date => {
    clock = Math.max(Date.now(), clock + 1);
    return new Date(clock);
  };

  const list = (keep: (invitation: StoredInvitation) => boolean) =>
    Promise.resolve([...invitations.values()].filter(keep).toSorted(newestFirst));

  const store: InvitationStore = {
    find: (id) => Promise.resolve(invitations.get(id) ?? null),
    listOpenForEmail: (email, now) =>
      list((invitation) => invitation.email === email && isInvitationOpen(invitation, now)),
    listPendingForTeam: (teamId) =>
      list((invitation) => invitation.teamId === teamId && invitation.status === "PENDING"),
    putPending: ({ invitedBy, ...draft }) => {
      const earlier = [...invitations.values()].find(
        (invitation) => invitation.email === draft.email && invitation.teamId === draft.teamId,
      );
      created += 1;
      const at = stamp();
      const invitation: StoredInvitation = {
        ...draft,
        createdAt: earlier?.createdAt ?? at,
        id: earlier?.id ?? `c${String(created).padStart(24, "0")}`,
        invitedBy: { email: invitedBy.email, name: invitedBy.name },
        status: "PENDING",
        updatedAt: at,
      };
      invitations.set(invitation.id, invitation);
      return Promise.resolve(invitation);
    },
    transition: async (expected, change, membership) => {
      const current = invitations.get(expected.id);
      if (current === undefined || !sameVersion(current, expected)) {
        return false;
      }
      invitations.set(current.id, { ...current, ...change, updatedAt: stamp() });
      if (membership !== undefined) {
        try {
          await grantMembership(membership);
        } catch (error) {
          invitations.set(current.id, current);
          throw error;
        }
      }
      return true;
    },
  };

  return {
    ...store,
    seed: (invitation: StoredInvitation) => {
      invitations.set(invitation.id, invitation);
    },
  };
};

export { createMemoryInvitationStore };
