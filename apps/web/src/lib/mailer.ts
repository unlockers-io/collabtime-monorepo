import { sendTransactionalEmail } from "@repo/transactional";
import type { MailerConfig, TransactionalEmail } from "@repo/transactional";
import { createTransport } from "@repo/transactional/transport";

import { getEnv } from "./env";
import { log } from "./observability";

type MailerDeps = {
  getConfig: () => MailerConfig;
  report: (event: { error?: unknown; message: string; route: string }) => void;
  send: (
    email: TransactionalEmail,
    config: MailerConfig,
  ) => Promise<{ error?: unknown; success: boolean }>;
};

let cachedMailerConfig: MailerConfig | undefined;

const getMailerConfig = (): MailerConfig => {
  cachedMailerConfig ??= {
    from: getEnv("RESEND_FROM_EMAIL"),
    transport: createTransport({
      apiKey: getEnv("RESEND_API_KEY"),
      transport: getEnv("MAIL_TRANSPORT"),
    }),
  };

  return cachedMailerConfig;
};

export { getMailerConfig };

export const createAppMailer =
  ({ getConfig, report, send }: MailerDeps) =>
  async (email: TransactionalEmail): Promise<{ sent: boolean }> => {
    try {
      const result = await send(email, getConfig());

      if (!result.success) {
        report({ error: result.error, message: "Failed to send email", route: "lib/mailer" });
      }

      return { sent: result.success };
    } catch (error) {
      report({ error, message: "Failed to send email", route: "lib/mailer" });

      return { sent: false };
    }
  };

export const sendAppEmail = createAppMailer({
  getConfig: getMailerConfig,
  report: (event) => {
    log.error(event);
  },
  send: sendTransactionalEmail,
});
