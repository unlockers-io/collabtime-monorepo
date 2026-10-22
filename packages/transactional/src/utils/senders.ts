import * as React from "react";

import { APP_NAME, DEFAULT_FROM } from "../brand";
import { ChangeEmail } from "../emails/change-email";
import { InvitationEmail } from "../emails/invitation";
import { InvitationDecided } from "../emails/invitation-decided";
import { JoinRequestDecided } from "../emails/join-request-decided";
import { JoinRequestReceived } from "../emails/join-request-received";
import { PasswordResetEmail } from "../emails/password-reset";
import { SignUpAttemptEmail } from "../emails/sign-up-attempt";
import { WelcomeEmail } from "../emails/welcome";
import { teamLabel } from "../team-label";

import { sendEmail } from "./send-email";

type MailerConfig = {
  apiKey: string;
  defaultReplyTo?: string;
  from?: string;
};

type WelcomePayload = {
  userEmail: string;
  userId: string;
  username?: string;
  verificationUrl: string;
};

type SignUpAttemptPayload = {
  resetPasswordUrl: string;
  signInUrl: string;
  userEmail: string;
  userId: string;
  username?: string;
};

type PasswordResetPayload = {
  browserInfo?: string;
  ipAddress?: string;
  resetUrl: string;
  userEmail: string;
  userId: string;
  username?: string;
};

type ChangeEmailPayload = {
  changeUrl: string;
  currentEmail: string;
  newEmail: string;
  userId: string;
  username?: string;
};

type InvitationPayload = {
  expiresAt?: string;
  inviterName: string;
  recipientEmail: string;
  teamId: string;
  teamName: string;
  teamUrl: string;
};

type TeamNotificationPayload = {
  recipientEmail: string;
  teamId: string;
  teamName: string;
  teamUrl: string;
};

type TransactionalEmail =
  | ({ requesterName: string; type: "join-request-received" } & TeamNotificationPayload)
  | ({ decision: "approved" | "denied"; type: "join-request-decided" } & TeamNotificationPayload)
  | ({
      decision: "accepted" | "declined";
      inviteeName: string;
      type: "invitation-decided";
    } & TeamNotificationPayload)
  | ({ type: "welcome" } & WelcomePayload)
  | ({ type: "sign-up-attempt" } & SignUpAttemptPayload)
  | ({ type: "password-reset" } & PasswordResetPayload)
  | ({ type: "change-email-confirmation" } & ChangeEmailPayload)
  | ({ type: "invitation" } & InvitationPayload);

type EmailBuild = { subject: string; template: React.ReactElement; to: string };

const buildEmail = (email: TransactionalEmail): EmailBuild => {
  switch (email.type) {
    case "join-request-received": {
      return {
        subject: `${email.requesterName} requested to join ${teamLabel(email.teamName)}`,
        template: React.createElement(JoinRequestReceived, email),
        to: email.recipientEmail,
      };
    }

    case "join-request-decided": {
      return {
        subject: `Your request to join ${teamLabel(email.teamName)} was ${email.decision}`,
        template: React.createElement(JoinRequestDecided, email),
        to: email.recipientEmail,
      };
    }

    case "invitation-decided": {
      return {
        subject: `${email.inviteeName} ${email.decision} your invitation to ${teamLabel(email.teamName)}`,
        template: React.createElement(InvitationDecided, email),
        to: email.recipientEmail,
      };
    }

    case "change-email-confirmation": {
      return {
        subject: `Confirm change of your ${APP_NAME} account email`,
        template: React.createElement(ChangeEmail, {
          changeUrl: email.changeUrl,
          currentEmail: email.currentEmail,
          newEmail: email.newEmail,
          username: email.username,
        }),
        to: email.currentEmail,
      };
    }

    case "invitation": {
      return {
        subject: `${email.inviterName} invited you to join ${teamLabel(email.teamName)} on ${APP_NAME}`,
        template: React.createElement(InvitationEmail, {
          expiresAt: email.expiresAt,
          inviterName: email.inviterName,
          recipientEmail: email.recipientEmail,
          teamName: email.teamName,
          teamUrl: email.teamUrl,
        }),
        to: email.recipientEmail,
      };
    }

    case "password-reset": {
      return {
        subject: `Reset your ${APP_NAME} password`,
        template: React.createElement(PasswordResetEmail, {
          browserInfo: email.browserInfo,
          ipAddress: email.ipAddress,
          resetUrl: email.resetUrl,
          userEmail: email.userEmail,
          username: email.username,
        }),
        to: email.userEmail,
      };
    }

    case "sign-up-attempt": {
      return {
        subject: `Sign-up attempt with your ${APP_NAME} account`,
        template: React.createElement(SignUpAttemptEmail, {
          resetPasswordUrl: email.resetPasswordUrl,
          signInUrl: email.signInUrl,
          userEmail: email.userEmail,
          username: email.username,
        }),
        to: email.userEmail,
      };
    }

    case "welcome": {
      const greetingName =
        email.username !== undefined && email.username !== "" ? `, ${email.username}` : "";

      return {
        subject: `Welcome to ${APP_NAME}${greetingName}! Please verify your email`,
        template: React.createElement(WelcomeEmail, {
          userEmail: email.userEmail,
          username: email.username,
          verificationUrl: email.verificationUrl,
        }),
        to: email.userEmail,
      };
    }

    default: {
      const unhandled: never = email;
      throw new Error(`Unhandled transactional email: ${String(unhandled)}`);
    }
  }
};

const buildTags = (email: TransactionalEmail) => [
  { name: "type", value: email.type },
  ...("teamId" in email ? [{ name: "teamId", value: email.teamId }] : []),
  ...("userId" in email ? [{ name: "userId", value: email.userId }] : []),
];

const createTransactionalEmailSender =
  (deliver: typeof sendEmail) => (email: TransactionalEmail, config: MailerConfig) => {
    const { subject, template, to } = buildEmail(email);
    const from = config.from !== undefined && config.from !== "" ? config.from : DEFAULT_FROM;

    return deliver({
      apiKey: config.apiKey,
      defaultReplyTo: config.defaultReplyTo,
      from,
      subject,
      tags: buildTags(email),
      template,
      to,
    });
  };

const sendTransactionalEmail = createTransactionalEmailSender(sendEmail);

export type { MailerConfig, TransactionalEmail };

export { createTransactionalEmailSender, sendTransactionalEmail };
