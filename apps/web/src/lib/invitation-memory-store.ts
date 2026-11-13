import { isInvitationOpen } from "./invitation-expiry";
import type { InvitationStore, StoredInvitation } from "./invitations";

const newestFirst = (left: StoredInvitation, right: StoredInvitation): number =>
  right.createdAt.getTime() - left.createdAt.getTime();

const sameVersion = (left: StoredInvitation, right: StoredInvitation): boolean =>
  left.status === right.status && left.updatedAt.getTime() === right.updatedAt.getTime();

const createMemoryInvitationStore = (now: () => Date = () => new Date()) => {
  const invitations = new Map<string, StoredInvitation>();
  let created = 0;
  let clock = 0;
  let pending = Promise.resolve<undefined>(undefined);

  const write = async <T>(run: () => Promise<T>): Promise<T> => {
    const previous = pending;
    const gate = Promise.withResolvers<undefined>();
    pending = gate.promise;
    await previous;

    try {
      return await run();
    } finally {
      gate.resolve(undefined);
    }
  };

  // Every write moves `updatedAt` forward, even within one millisecond, so versions never repeat.
  const stamp = (): Date => {
    clock = Math.max(Date.now(), clock + 1);

    return new Date(clock);
  };

  const list = (keep: (invitation: StoredInvitation) => boolean) =>
    Promise.resolve([...invitations.values()].filter(keep).toSorted(newestFirst));

  const store: InvitationStore<undefined> = {
    find: (id) => Promise.resolve(invitations.get(id) ?? null),
    listOpenForEmail: (email, at) =>
      list((invitation) => invitation.email === email && isInvitationOpen(invitation, at)),
    listPendingForTeam: (teamId) =>
      list((invitation) => invitation.teamId === teamId && invitation.status === "PENDING"),
    putPending: ({ invitedBy, ...draft }) =>
      write(() => {
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
      }),
    transition: (expected, change) =>
      write(() => {
        const current = invitations.get(expected.id);

        if (current === undefined || !sameVersion(current, expected)) {
          return Promise.resolve(false);
        }

        if (
          (change.status === "ACCEPTED" || change.status === "DECLINED") &&
          !isInvitationOpen(current, now())
        ) {
          return Promise.resolve(false);
        }

        invitations.set(current.id, { ...current, ...change, updatedAt: stamp() });

        return Promise.resolve(true);
      }),
  };

  return {
    ...store,
    seed: (invitation: StoredInvitation) => {
      invitations.set(invitation.id, invitation);
    },
  };
};

export { createMemoryInvitationStore };
