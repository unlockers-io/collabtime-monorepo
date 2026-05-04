// oxlint-disable require-await -- email sender functions present an async API for callers; React render itself is sync

import * as React from "react";

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

const DEFAULT_FROM = "Collab Time <noreply@collabtime.io>";

const sendWelcomeEmail = async (
  {
    userEmail,
    username,
    verificationUrl,
  }: {
    userEmail: string;
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
      ...(username ? [{ name: "username", value: username }] : []),
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
    username,
  }: {
    resetPasswordUrl: string;
    signInUrl: string;
    userEmail: string;
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
      ...(username ? [{ name: "username", value: username }] : []),
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
    username,
  }: {
    browserInfo?: string;
    ipAddress?: string;
    resetUrl: string;
    userEmail: string;
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
      ...(username ? [{ name: "username", value: username }] : []),
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
    teamName,
    teamUrl,
  }: {
    inviterName: string;
    recipientEmail: string;
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
      { name: "team", value: teamName },
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

export { sendInvitationEmail, sendPasswordResetEmail, sendSignUpAttemptEmail, sendWelcomeEmail };
