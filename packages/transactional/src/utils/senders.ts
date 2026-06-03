import * as React from "react";

import { ChangeEmail } from "../emails/change-email";
import { InvitationEmail } from "../emails/invitation";
import { PasswordResetEmail } from "../emails/password-reset";
import { SignUpAttemptEmail } from "../emails/sign-up-attempt";
import { WelcomeEmail } from "../emails/welcome";

import { sendEmail } from "./send-email";

type EmailConfig = {
  apiKey: string;
  defaultReplyTo?: string;
  from?: string;
};

const DEFAULT_FROM = "Collab Time <noreply@email.collabtime.io>";

const sendWelcomeEmail = async (
  {
    userEmail,
    userId,
    username,
    verificationUrl,
  }: {
    userEmail: string;
    userId: string;
    username?: string;
    verificationUrl: string;
  },
  config: EmailConfig,
) => {
  return sendEmail({
    apiKey: config.apiKey,
    defaultReplyTo: config.defaultReplyTo,
    from: config.from || DEFAULT_FROM,
    subject: `Welcome to Collab Time${username ? `, ${username}` : ""}! Please verify your email`,
    tags: [
      { name: "type", value: "welcome" },
      { name: "userId", value: userId },
    ],
    template: React.createElement(WelcomeEmail, {
      userEmail,
      username,
      verificationUrl,
    }),
    to: userEmail,
  });
};

const sendSignUpAttemptEmail = async (
  {
    resetPasswordUrl,
    signInUrl,
    userEmail,
    userId,
    username,
  }: {
    resetPasswordUrl: string;
    signInUrl: string;
    userEmail: string;
    userId: string;
    username?: string;
  },
  config: EmailConfig,
) => {
  return sendEmail({
    apiKey: config.apiKey,
    defaultReplyTo: config.defaultReplyTo,
    from: config.from || DEFAULT_FROM,
    subject: "Sign-up attempt with your Collab Time account",
    tags: [
      { name: "type", value: "sign-up-attempt" },
      { name: "userId", value: userId },
    ],
    template: React.createElement(SignUpAttemptEmail, {
      resetPasswordUrl,
      signInUrl,
      userEmail,
      username,
    }),
    to: userEmail,
  });
};

const sendPasswordResetEmail = async (
  {
    browserInfo,
    ipAddress,
    resetUrl,
    userEmail,
    userId,
    username,
  }: {
    browserInfo?: string;
    ipAddress?: string;
    resetUrl: string;
    userEmail: string;
    userId: string;
    username?: string;
  },
  config: EmailConfig,
) => {
  return sendEmail({
    apiKey: config.apiKey,
    defaultReplyTo: config.defaultReplyTo,
    from: config.from || DEFAULT_FROM,
    subject: "Reset your Collab Time password",
    tags: [
      { name: "type", value: "password-reset" },
      { name: "userId", value: userId },
    ],
    template: React.createElement(PasswordResetEmail, {
      browserInfo,
      ipAddress,
      resetUrl,
      userEmail,
      username,
    }),
    to: userEmail,
  });
};

const sendInvitationEmail = async (
  {
    inviterName,
    recipientEmail,
    teamId,
    teamName,
    teamUrl,
  }: {
    inviterName: string;
    recipientEmail: string;
    teamId: string;
    teamName: string;
    teamUrl: string;
  },
  config: EmailConfig,
) => {
  return sendEmail({
    apiKey: config.apiKey,
    defaultReplyTo: config.defaultReplyTo,
    from: config.from || DEFAULT_FROM,
    subject: `${inviterName} invited you to join ${teamName} on Collab Time`,
    tags: [
      { name: "type", value: "invitation" },
      { name: "teamId", value: teamId },
    ],
    template: React.createElement(InvitationEmail, {
      inviterName,
      recipientEmail,
      teamName,
      teamUrl,
    }),
    to: recipientEmail,
  });
};

const sendChangeEmailConfirmation = async (
  {
    changeUrl,
    currentEmail,
    newEmail,
    userId,
    username,
  }: {
    changeUrl: string;
    currentEmail: string;
    newEmail: string;
    userId: string;
    username?: string;
  },
  config: EmailConfig,
) => {
  return sendEmail({
    apiKey: config.apiKey,
    defaultReplyTo: config.defaultReplyTo,
    from: config.from || DEFAULT_FROM,
    subject: "Confirm change of your Collab Time account email",
    tags: [
      { name: "type", value: "change-email-confirmation" },
      { name: "userId", value: userId },
    ],
    template: React.createElement(ChangeEmail, {
      changeUrl,
      currentEmail,
      newEmail,
      username,
    }),
    // Consent step goes to the current email; mailbox-ownership step on the new email is a separate hook.
    to: currentEmail,
  });
};

export {
  sendChangeEmailConfirmation,
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendSignUpAttemptEmail,
  sendWelcomeEmail,
};
