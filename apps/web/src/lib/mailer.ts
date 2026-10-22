import { sendTransactionalEmail } from "@repo/transactional";
import type { MailerConfig, TransactionalEmail } from "@repo/transactional";

import { getEnv } from "./env";
import { log } from "./observability";

type MailerDeps = {
  getConfig: () => MailerConfig | null;
  report: (
    event: { error?: unknown; message: string; route: string },
    level: "error" | "warn",
  ) => void;
  send: (
    email: TransactionalEmail,
    config: MailerConfig,
  ) => Promise<{ error?: unknown; success: boolean }>;
};

const getMailerConfig = (): MailerConfig | null => {
  const apiKey = getEnv("RESEND_API_KEY");

  return apiKey !== undefined && apiKey !== ""
    ? { apiKey, from: getEnv("RESEND_FROM_EMAIL") }
    : null;
};

export const createAppMailer =
  ({ getConfig, report, send }: MailerDeps) =>
  async (email: TransactionalEmail): Promise<{ sent: boolean }> => {
    try {
      const config = getConfig();

      if (!config) {
        report({ message: "Email delivery is not configured", route: "lib/mailer" }, "warn");

        return { sent: false };
      }

      const result = await send(email, config);

      if (!result.success) {
        report(
          { error: result.error, message: "Failed to send email", route: "lib/mailer" },
          "error",
        );
      }

      return { sent: result.success };
    } catch (error) {
      report({ error, message: "Failed to send email", route: "lib/mailer" }, "error");

      return { sent: false };
    }
  };

export const sendAppEmail = createAppMailer({
  getConfig: getMailerConfig,
  report: (event, level) => {
    log[level](event);
  },
  send: sendTransactionalEmail,
});
