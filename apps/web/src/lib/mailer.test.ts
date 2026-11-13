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

it("reports returned and thrown delivery failures without throwing", async () => {
  const report = vi.fn<() => void>();

  const send = vi
    .fn()
    .mockResolvedValueOnce({ error: "Rejected", success: false })
    .mockRejectedValueOnce(new Error("Unavailable"));

  const mailer = createAppMailer({ getConfig: () => ({ transport: vi.fn() }), report, send });
  expect(await mailer(email)).toEqual({ sent: false });
  expect(await mailer(email)).toEqual({ sent: false });
  expect(report).toHaveBeenCalledTimes(2);
});
