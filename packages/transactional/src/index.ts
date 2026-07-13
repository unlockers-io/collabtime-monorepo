export { createResendClient } from "./client";

export { sendEmail, sendBatchEmails, previewEmail } from "./utils/send-email";
export type { MailerConfig, TransactionalEmail } from "./utils/senders";
export { sendTransactionalEmail } from "./utils/senders";

export { emailTheme, tailwindConfig } from "./styles/theme";
