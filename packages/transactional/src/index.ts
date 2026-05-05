// Client
export { createResendClient } from "./client";

// Utilities
export { sendEmail, sendBatchEmails, previewEmail } from "./utils/send-email";
export {
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendSignUpAttemptEmail,
  sendWelcomeEmail,
} from "./utils/senders";

// Theme
export { emailTheme, tailwindConfig } from "./styles/theme";
