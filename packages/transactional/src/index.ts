export { createResendClient } from "./client";

export { sendEmail, sendBatchEmails, previewEmail } from "./utils/send-email";
export {
  sendChangeEmailConfirmation,
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendSignUpAttemptEmail,
  sendWelcomeEmail,
} from "./utils/senders";

export { emailTheme, tailwindConfig } from "./styles/theme";
