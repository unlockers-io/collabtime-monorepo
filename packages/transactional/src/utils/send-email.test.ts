import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Transport } from "../transport";

import { sendEmail } from "./send-email";

const sendMock = vi.fn<Transport>();

describe("sendEmail from validation", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "test" }, error: null, headers: null });
  });

  const template = createElement("div", null, "hi");

  it('accepts "Display Name <email>" form in from', async () => {
    const result = await sendEmail({
      from: "Collabtime <noreply@email.collabtime.io>",
      subject: "x",
      template,
      to: "delivered+test@resend.dev",
      transport: sendMock,
    });

    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock.mock.calls[0]?.[0]).toMatchObject({
      from: "Collabtime <noreply@email.collabtime.io>",
    });
  });

  it("accepts bare email in from", async () => {
    const result = await sendEmail({
      from: "noreply@email.collabtime.io",
      subject: "x",
      template,
      to: "delivered+test@resend.dev",
      transport: sendMock,
    });

    expect(result.success).toBe(true);
  });

  it("rejects from values that are neither bare email nor wrapped form", async () => {
    const result = await sendEmail({
      from: "not-an-email",
      subject: "x",
      template,
      to: "delivered+test@resend.dev",
      transport: sendMock,
    });

    expect(result.success).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
