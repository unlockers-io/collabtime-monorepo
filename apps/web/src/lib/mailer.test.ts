import type { TransactionalEmail } from "@repo/transactional";
import { expect, it, vi } from "vitest";

import { createAppMailer } from "./mailer";

const email: TransactionalEmail = {
  inviterName: "Owner",
  recipientEmail: "friend@example.com",
  teamId: "team",
  teamName: "Team",
  teamUrl: "https://example.com/team",
  type: "invitation",
};

it("warns when email is unconfigured without attempting delivery", async () => {
  const report = vi.fn<() => void>();
  const send = vi.fn();
  expect(await createAppMailer({ getConfig: () => null, report, send })(email)).toEqual({
    sent: false,
  });
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Email delivery is not configured" }),
    "warn",
  );
  expect(send).not.toHaveBeenCalled();
});

it("reports returned and thrown delivery failures without throwing", async () => {
  const report = vi.fn<() => void>();

  const send = vi
    .fn()
    .mockResolvedValueOnce({ error: "Rejected", success: false })
    .mockRejectedValueOnce(new Error("Unavailable"));

  const mailer = createAppMailer({ getConfig: () => ({ apiKey: "test" }), report, send });
  expect(await mailer(email)).toEqual({ sent: false });
  expect(await mailer(email)).toEqual({ sent: false });
  expect(report).toHaveBeenCalledTimes(2);
});
