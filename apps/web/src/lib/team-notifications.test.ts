import { expect, it, vi } from "vitest";

import { createTeamNotifier } from "./team-notifications";

it("notifies each admin, the requester and the inviter with the right decision", async () => {
  const sendEmail = vi.fn().mockResolvedValue({ sent: true });

  const notifier = createTeamNotifier({
    appUrl: () => "https://example.com",
    listTeamAdmins: () =>
      Promise.resolve([
        { email: "admin@example.com", name: "Admin" },
        { email: "owner@example.com", name: "Owner" },
      ]),
    readTeamName: () => Promise.resolve("Team"),
    reportError: vi.fn<() => void>(),
    sendEmail,
  });

  const user = { email: "friend@example.com", name: "Friend" };
  await notifier.notifyAdminsOfJoinRequest("team", user);
  expect(sendEmail).toHaveBeenCalledTimes(2);
  expect(sendEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      recipientEmail: "admin@example.com",
      requesterName: "Friend",
      type: "join-request-received",
    }),
  );
  await notifier.notifyRequesterOfDecision({ teamId: "team", user }, "approved");
  await notifier.notifyRequesterOfDecision({ teamId: "team", user }, "denied");
  await notifier.notifyInviterOfDecision(
    { invitedBy: { email: "owner@example.com", name: "Owner" }, teamId: "team" },
    user,
    "accepted",
  );
  await notifier.notifyInviterOfDecision(
    { invitedBy: { email: "owner@example.com", name: "Owner" }, teamId: "team" },
    user,
    "declined",
  );
  expect(sendEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      decision: "denied",
      recipientEmail: user.email,
      type: "join-request-decided",
    }),
  );
  expect(sendEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      decision: "declined",
      recipientEmail: "owner@example.com",
      type: "invitation-decided",
    }),
  );
});

it("reports lookup failures without rejecting", async () => {
  const reportError = vi.fn<() => void>();

  const notifier = createTeamNotifier({
    appUrl: () => "https://example.com",
    listTeamAdmins: () => Promise.reject(new Error("Unavailable")),
    readTeamName: () => Promise.resolve(null),
    reportError,
    sendEmail: vi.fn(),
  });

  await notifier.notifyAdminsOfJoinRequest("team", { email: "friend@example.com", name: "Friend" });
  expect(reportError).toHaveBeenCalled();
});
