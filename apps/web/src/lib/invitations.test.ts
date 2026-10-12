import type { TransactionalEmail } from "@repo/transactional";
import { describe, expect, it, vi } from "vitest";

import type { TeamRecord } from "@/types";

import {
  createMockSession,
  createTestAccess,
  createTestMember,
  createTestTeamRecord,
  createTestTeamStore,
  VALID_UUID,
  VALID_UUID_2,
} from "./actions/test-helpers";
import { createMemoryInvitationStore } from "./invitation-memory-store";
import {
  createInvitations,
  INVITATION_EXPIRED_ERROR,
  type InvitationDeps,
  isInvitationOpen,
  maskEmail,
  openInvitationWhere,
  type StoredInvitation,
} from "./invitations";
import { createRateLimiter } from "./space-rate-limit";

const NOW = new Date("2026-09-10T12:00:00Z");
const DAY = 86_400_000;
const EXPIRY = "2026-09-24T12:00:00.000Z";
const EMAIL = "invitee@example.com";
const NOT_PENDING = { error: "This invitation is no longer pending", success: false };
const STALE = { error: "Could not update this invitation. Refresh and try again.", success: false };

const admin = createTestAccess();
const invitee = createMockSession({ email: EMAIL, name: "Ivy", userId: "invitee" }).user;
const invitedTeam = createTestTeamRecord({ members: [createTestMember({ id: VALID_UUID_2 })] });
const request = { email: EMAIL, memberId: VALID_UUID_2 };

type Overrides = Partial<
  Pick<InvitationDeps<undefined>, "checkRateLimit" | "isMember" | "sendEmail">
>;

const setup = async (team: TeamRecord | null = invitedTeam, overrides: Overrides = {}) => {
  const harness = createTestTeamStore();
  if (team !== null) {
    await harness.seedTeam(team);
  }
  const clock = { now: NOW };
  const store = createMemoryInvitationStore(harness.membershipStore.grant, () => clock.now);
  const hits = new Map<string, number>();
  const outbox: Array<TransactionalEmail> = [];
  const race: { next?: () => Promise<void> } = {};
  const notifyInviter = vi.fn<InvitationDeps<undefined>["notifyInviter"]>();
  const invitations = createInvitations({
    appUrl: () => "https://app.example.com",
    checkRateLimit: createRateLimiter({
      increment: (key) => {
        hits.set(key, (hits.get(key) ?? 0) + 1);
        return Promise.resolve(hits.get(key) ?? 0);
      },
      isRedisConfigured: () => true,
    }),
    grantMembership: harness.grantMembership,
    isMember: () => Promise.resolve(false),
    notifyInviter,
    now: () => clock.now,
    readTeamRecord: (teamId) => harness.readTeam(teamId),
    reportError: vi.fn<InvitationDeps<undefined>["reportError"]>(),
    sendEmail: (email) => {
      outbox.push(email);
      return Promise.resolve({ sent: true });
    },
    store: {
      ...store,
      find: async (id) => {
        const found = await store.find(id);
        const interleaved = race.next;
        race.next = undefined;
        await interleaved?.();
        return found;
      },
    },
    ...overrides,
  });
  const invite = async (email = EMAIL) => {
    const invited = await invitations.invite(admin, { ...request, email });
    if (!invited.success) {
      throw new Error(invited.error);
    }
    return invited.data.invitationId;
  };
  const pending = async () => {
    const listed = await invitations.listForTeam(admin);
    return listed.success ? listed.data : [];
  };
  const slot = async () => {
    const stored = await harness.readTeam();
    return stored?.members.find((member) => member.id === VALID_UUID_2);
  };
  const advance = (days: number) => {
    clock.now = new Date(clock.now.getTime() + days * DAY);
  };
  const rewrite = async (id: string, patch: Partial<StoredInvitation>) => {
    const stored = await store.find(id);
    if (stored === null) {
      throw new Error(`Invitation ${id} is missing`);
    }
    store.seed({ ...stored, ...patch });
  };
  return {
    advance,
    harness,
    invitations,
    invite,
    notifyInviter,
    outbox,
    pending,
    race,
    rewrite,
    slot,
    store,
  };
};

const refusal = async (team: TeamRecord | null, overrides: Overrides, input = request) => {
  const { invitations, outbox } = await setup(team, overrides);
  const invited = await invitations.invite(admin, input);
  expect(outbox).toEqual([]);
  return invited.success ? null : invited.error;
};

describe("invitation rules", () => {
  it("opens pending invitations until they expire, and legacy ones without an expiry", () => {
    expect(isInvitationOpen({ expiresAt: null, status: "PENDING" }, NOW)).toBe(true);
    expect(isInvitationOpen({ expiresAt: NOW, status: "PENDING" }, NOW)).toBe(false);
    expect(isInvitationOpen({ expiresAt: null, status: "REVOKED" }, NOW)).toBe(false);
    expect(openInvitationWhere(NOW)).toEqual({
      OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }],
      status: "PENDING",
    });
    expect(maskEmail("pedro@x.io")).toBe("p***@x.io");
  });
});

describe("inviting", () => {
  it("stores a normalized pending invitation for fourteen days and mails its link", async () => {
    const { invitations, invite, outbox, pending } = await setup();
    const id = await invite(" INVITEE@Example.com ");

    expect(await pending()).toEqual([
      {
        createdAt: expect.any(String),
        email: EMAIL,
        expiresAt: EXPIRY,
        id,
        memberId: VALID_UUID_2,
      },
    ]);
    expect(await invitations.listOpenForEmail(" Invitee@Example.com ")).toMatchObject([{ id }]);
    expect(outbox).toEqual([
      {
        expiresAt: EXPIRY,
        inviterName: "Test User",
        recipientEmail: EMAIL,
        teamId: VALID_UUID,
        teamName: "Test Team",
        teamUrl: `https://app.example.com/${VALID_UUID}?invite=${id}`,
        type: "invitation",
      },
    ]);
  });

  it("refuses bad input, claimed slots and existing members without sending", async () => {
    const claimed = createTestTeamRecord({
      members: [createTestMember({ id: VALID_UUID_2, userId: "someone" })],
    });
    expect(await refusal(invitedTeam, {}, { ...request, memberId: "nope" })).toBe(
      "Invalid member ID",
    );
    expect(await refusal(invitedTeam, {}, { ...request, email: "nope" })).toBe(
      "Invalid email address",
    );
    expect(await refusal(null, {})).toBe("Team not found");
    expect(await refusal(invitedTeam, {}, { ...request, memberId: VALID_UUID })).toBe(
      "Member not found",
    );
    expect(await refusal(claimed, {})).toBe("This member slot is already claimed");
    expect(await refusal(invitedTeam, { isMember: () => Promise.resolve(true) })).toBe(
      "This user is already a member of the team",
    );
  });

  it("counts invites and resends against the same sender limit", async () => {
    const { invitations, invite, outbox } = await setup();
    const [id = ""] = await Promise.all(Array.from({ length: 50 }, () => invite()));

    expect(await invitations.resend(admin, id)).toEqual({
      error: "Too many invitations. Try again later.",
      success: false,
    });
    expect(outbox).toHaveLength(50);
  });

  it("neither stores nor sends when the rate limiter fails", async () => {
    const { invitations, outbox, pending } = await setup(invitedTeam, {
      checkRateLimit: () => Promise.reject(new Error("Redis unavailable")),
    });

    expect(await invitations.invite(admin, request)).toEqual({
      error: "Failed to send invitation",
      success: false,
    });
    expect(await pending()).toEqual([]);
    expect(outbox).toEqual([]);
  });

  it("keeps the invitation when mail is not delivered", async () => {
    const { invitations, pending } = await setup(invitedTeam, {
      sendEmail: () => Promise.resolve({ sent: false }),
    });

    expect(await invitations.invite(admin, request)).toMatchObject({
      data: { emailSent: false },
      success: true,
    });
    expect(await pending()).toHaveLength(1);
  });

  it("reopens a declined invitation as a fresh pending one", async () => {
    const { advance, invitations, invite, pending } = await setup();
    const id = await invite();
    await invitations.decline(invitee, id);
    advance(1);

    expect(await invite()).toBe(id);
    expect(await pending()).toMatchObject([{ expiresAt: "2026-09-25T12:00:00.000Z", id }]);
    expect(await invitations.accept(invitee, id)).toMatchObject({ success: true });
  });
});

describe("deciding", () => {
  it("accepts a case-insensitive address into the invited slot and tells the inviter", async () => {
    const { harness, invitations, invite, notifyInviter, pending, slot } = await setup();
    const id = await invite();
    const shouting = { ...invitee, email: " INVITEE@EXAMPLE.COM " };

    expect(await invitations.accept(shouting, id)).toEqual({
      data: { teamId: VALID_UUID },
      success: true,
    });
    expect(await slot()).toMatchObject({ userId: "invitee" });
    expect(harness.findMembership("invitee")).toEqual({ archivedAt: null, role: "MEMBER" });
    expect(await pending()).toEqual([]);
    expect(notifyInviter).toHaveBeenCalledWith(
      expect.objectContaining({ id }),
      shouting,
      "accepted",
    );
  });

  it("declines without touching the roster or memberships", async () => {
    const { harness, invitations, invite, notifyInviter, slot } = await setup();
    const id = await invite();

    expect(await invitations.decline(invitee, id)).toEqual({ data: undefined, success: true });
    expect(await slot()).toEqual(createTestMember({ id: VALID_UUID_2 }));
    expect(harness.findMembership("invitee")).toBeNull();
    expect(notifyInviter).toHaveBeenCalledWith(
      expect.objectContaining({ id }),
      invitee,
      "declined",
    );
  });

  it("rejects another address before claiming any slot", async () => {
    const { invitations, invite, slot } = await setup();
    const id = await invite();
    const stranger = createMockSession({ email: "someone@example.com" }).user;

    expect(await invitations.accept(stranger, id)).toEqual({
      error: "This invitation is not for you",
      success: false,
    });
    expect(await slot()).toEqual(createTestMember({ id: VALID_UUID_2 }));
  });

  it("closes an invitation at its exact expiry", async () => {
    const { advance, invitations, invite } = await setup();
    const id = await invite();
    advance(14);

    const expired = { error: INVITATION_EXPIRED_ERROR, success: false };
    expect(await invitations.accept(invitee, id)).toEqual(expired);
    expect(await invitations.decline(invitee, id)).toEqual(expired);
    expect(await invitations.listOpenForEmail(EMAIL)).toEqual([]);
  });

  it("keeps legacy invitations without an expiry open", async () => {
    const { advance, invitations, invite, rewrite } = await setup();
    const id = await invite();
    await rewrite(id, { expiresAt: null });
    advance(365);

    expect(await invitations.listOpenForEmail(EMAIL)).toMatchObject([{ id }]);
    expect(await invitations.accept(invitee, id)).toMatchObject({ success: true });
  });

  it("rejects decisions and management once an invitation is decided", async () => {
    const { invitations, invite } = await setup();
    const id = await invite();
    await invitations.accept(invitee, id);

    expect(await invitations.accept(invitee, id)).toEqual(NOT_PENDING);
    expect(await invitations.decline(invitee, id)).toEqual(NOT_PENDING);
    expect(await invitations.revoke(admin, id)).toEqual(NOT_PENDING);
    expect(await invitations.resend(admin, id)).toEqual(NOT_PENDING);
  });

  it("fails an acceptance when a revoke lands after it read the invitation", async () => {
    const { harness, invitations, invite, notifyInviter, pending, race, slot } = await setup();
    const id = await invite();
    race.next = async () => {
      await invitations.revoke(admin, id);
    };

    expect(await invitations.accept(invitee, id)).toEqual(STALE);
    expect(await slot()).toEqual(createTestMember({ id: VALID_UUID_2 }));
    expect(harness.findMembership("invitee")).toBeNull();
    expect(await pending()).toEqual([]);
    expect(notifyInviter).not.toHaveBeenCalled();
  });

  it("hands the slot back when the commit fails, so a retry claims it", async () => {
    const { harness, invitations, invite, pending, slot } = await setup();
    const id = await invite();
    harness.membershipStore.grant.mockRejectedValueOnce(new Error("Database unavailable"));

    expect(await invitations.accept(invitee, id)).toEqual(STALE);
    expect(await slot()).toEqual(createTestMember({ id: VALID_UUID_2 }));
    expect(await pending()).toMatchObject([{ id }]);

    expect(await invitations.accept(invitee, id)).toMatchObject({ success: true });
    expect(harness.findMembership("invitee")).toEqual({ archivedAt: null, role: "MEMBER" });
  });

  it("leaves the invitation pending when the team is gone", async () => {
    const { harness, invitations, invite, notifyInviter, rewrite, store } = await setup();
    const id = await invite();
    await rewrite(id, { teamId: VALID_UUID_2 });

    expect(await invitations.accept(invitee, id)).toEqual({
      error: "Team not found",
      success: false,
    });
    expect(harness.findMembership("invitee", VALID_UUID_2)).toBeNull();
    expect(await store.find(id)).toMatchObject({ status: "PENDING" });
    expect(notifyInviter).not.toHaveBeenCalled();
  });
});

describe("managing", () => {
  it("revokes an expired pending invitation", async () => {
    const { advance, invitations, invite, pending } = await setup();
    const id = await invite();
    advance(30);

    expect(await pending()).toMatchObject([{ expiresAt: EXPIRY, id }]);
    expect(await invitations.revoke(admin, id)).toEqual({ data: undefined, success: true });
    expect(await pending()).toEqual([]);
    expect(await invitations.accept(invitee, id)).toEqual(NOT_PENDING);
  });

  it("renews an expired invitation on resend in the original inviter's name", async () => {
    const { advance, invitations, invite, outbox, pending } = await setup();
    const id = await invite();
    advance(30);

    expect(await invitations.resend(admin, id)).toEqual({
      data: { emailSent: true },
      success: true,
    });
    expect(await pending()).toMatchObject([{ expiresAt: "2026-10-24T12:00:00.000Z", id }]);
    expect(outbox.at(-1)).toMatchObject({
      expiresAt: "2026-10-24T12:00:00.000Z",
      inviterName: "Test User",
    });
    expect(await invitations.accept(invitee, id)).toMatchObject({ success: true });
  });

  it("treats another team's or a malformed invitation as missing", async () => {
    const { invitations, invite, outbox, pending } = await setup();
    const id = await invite();
    const other = createTestAccess(VALID_UUID_2);
    const missing = { error: "Invitation not found", success: false };

    expect(await invitations.revoke(other, id)).toEqual(missing);
    expect(await invitations.resend(other, id)).toEqual(missing);
    expect(await invitations.revoke(admin, "not-a-cuid")).toEqual({
      error: "Invalid invitation ID",
      success: false,
    });
    expect(await pending()).toMatchObject([{ id }]);
    expect(outbox).toHaveLength(1);
  });
});
