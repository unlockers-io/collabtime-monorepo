"use server";

import { Resend } from "resend";

import { getEnv } from "./env";

const escapeHtml = (str: string) =>
  str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getResendClient = () => {
  const apiKey = getEnv("RESEND_API_KEY");
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
};

const sendInvitationEmail = async ({
  to,
  teamName,
  inviterName,
  teamUrl,
}: {
  inviterName: string;
  teamName: string;
  teamUrl: string;
  to: string;
}): Promise<boolean> => {
  const resend = getResendClient();
  const fromEmail = getEnv("RESEND_FROM_EMAIL");

  if (!resend || !fromEmail) {
    console.warn("[Email] Resend not configured, skipping invitation email to:", to);
    return false;
  }

  const safeInviterName = escapeHtml(inviterName);
  const safeTeamName = escapeHtml(teamName || "a team");
  const safeTeamUrl = /^https?:\/\//.test(teamUrl) ? escapeHtml(teamUrl) : "#";

  const subject = `${inviterName} invited you to join ${teamName || "a team"} on Collab Time`;

  await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
        <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">You've been invited</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          <strong>${safeInviterName}</strong> invited you to join <strong>${safeTeamName}</strong> on Collab Time.
        </p>
        <a href="${safeTeamUrl}" style="display: inline-block; background: #18181b; color: #fff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          View Invitation
        </a>
        <p style="color: #999; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">
          Sign in or create an account with this email address to accept the invitation.
        </p>
      </div>
    `,
  });

  return true;
};

export { sendInvitationEmail };
