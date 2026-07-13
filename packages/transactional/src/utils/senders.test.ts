import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmailMock = vi.fn();
vi.mock("./send-email", () => ({
  sendEmail: sendEmailMock,
}));

const { sendTransactionalEmail } = await import("./senders");

describe("sendTransactionalEmail", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ data: { id: "test" }, error: null, success: true });
  });

  it("routes welcome emails to the user with type + userId tags and mailer config", async () => {
    await sendTransactionalEmail(
      {
        type: "welcome",
        userEmail: "user@example.com",
        userId: "user-1",
        username: "Ada",
        verificationUrl: "https://collabtime.io/verify",
      },
      {
        apiKey: "re_test",
        defaultReplyTo: "support@collabtime.io",
        from: "Custom <c@collabtime.io>",
      },
    );

    expect(sendEmailMock).toHaveBeenCalledOnce();
    expect(sendEmailMock.mock.calls[0][0]).toMatchObject({
      apiKey: "re_test",
      defaultReplyTo: "support@collabtime.io",
      from: "Custom <c@collabtime.io>",
      subject: "Welcome to Collab Time, Ada! Please verify your email",
      tags: [
        { name: "type", value: "welcome" },
        { name: "userId", value: "user-1" },
      ],
      to: "user@example.com",
    });
  });

  it("falls back to the default from when the mailer omits it", async () => {
    await sendTransactionalEmail(
      {
        resetUrl: "https://collabtime.io/reset",
        type: "password-reset",
        userEmail: "user@example.com",
        userId: "user-1",
      },
      { apiKey: "re_test" },
    );

    expect(sendEmailMock.mock.calls[0][0]).toMatchObject({
      from: "Collab Time <noreply@email.collabtime.io>",
    });
  });

  it("sends change-email confirmation to the current address", async () => {
    await sendTransactionalEmail(
      {
        changeUrl: "https://collabtime.io/change",
        currentEmail: "old@example.com",
        newEmail: "new@example.com",
        type: "change-email-confirmation",
        userId: "user-1",
      },
      { apiKey: "re_test" },
    );

    expect(sendEmailMock.mock.calls[0][0]).toMatchObject({
      to: "old@example.com",
    });
  });

  it("tags invitations with teamId instead of userId", async () => {
    await sendTransactionalEmail(
      {
        inviterName: "Ada",
        recipientEmail: "invitee@example.com",
        teamId: "team-1",
        teamName: "Design",
        teamUrl: "https://collabtime.io",
        type: "invitation",
      },
      { apiKey: "re_test" },
    );

    expect(sendEmailMock.mock.calls[0][0]).toMatchObject({
      subject: "Ada invited you to join Design on Collab Time",
      tags: [
        { name: "type", value: "invitation" },
        { name: "teamId", value: "team-1" },
      ],
      to: "invitee@example.com",
    });
  });
});
