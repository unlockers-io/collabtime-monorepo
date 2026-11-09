import type { ReactElement } from "react";
import { render } from "react-email";
import { Resend } from "resend";
import { z } from "zod";

import { senderAddressSchema } from "../sender";

type SendEmailPayload = Parameters<Resend["emails"]["send"]>[0];

type SendEmailResponse = Awaited<ReturnType<Resend["emails"]["send"]>>;

type SendEmailTransport = (apiKey: string, payload: SendEmailPayload) => Promise<SendEmailResponse>;

const sanitizeTagSegment = (s: string): string =>
  s
    .replaceAll(/[^\-A-Za-z0-9_]+/gv, "-")
    .replaceAll(/^-+|-+$/gv, "")
    .slice(0, 256);

const recipientSchema = z.union([z.email(), z.array(z.email())]);

const resendErrorSchema = z.object({
  message: z.string().optional(),
  name: z.string().optional(),
});

const tagSchema = z.object({
  name: z.string().transform(sanitizeTagSegment),
  value: z.string().transform(sanitizeTagSegment),
});

const emailConfigSchema = z.object({
  bcc: recipientSchema.optional(),
  cc: recipientSchema.optional(),
  from: senderAddressSchema,
  replyTo: senderAddressSchema.optional(),
  subject: z.string(),
  tags: z
    .array(tagSchema)
    .transform((arr) => arr.filter((t) => t.name.length > 0 && t.value.length > 0))
    .optional(),
  to: recipientSchema,
});

type EmailConfig = z.input<typeof emailConfigSchema>;

type SendEmailOptions = EmailConfig & {
  apiKey: string;
  template: ReactElement;
};

const resendTransport: SendEmailTransport = (apiKey, payload) =>
  new Resend(apiKey).emails.send(payload);

const createSendEmail =
  (send: SendEmailTransport) =>
  async ({ apiKey, template, ...config }: SendEmailOptions) => {
    if (!apiKey) {
      throw new Error("API key is required for sending emails");
    }

    try {
      const validatedConfig = emailConfigSchema.parse(config);
      const html = await render(template);
      const text = await render(template, { plainText: true });

      const result = await send(apiKey, {
        bcc: validatedConfig.bcc,
        cc: validatedConfig.cc,
        from: validatedConfig.from,
        html,
        replyTo: validatedConfig.replyTo,
        subject: validatedConfig.subject,
        tags: validatedConfig.tags,
        text,
        to: validatedConfig.to,
      });

      if (result.error) {
        const error = resendErrorSchema.safeParse(result.error).data;
        throw new Error(
          `Resend failed to queue email: ${error?.name ?? "unknown_error"} - ${error?.message ?? "No message"}`,
        );
      }

      return { data: result.data, error: null, success: true };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "Failed to send email",
        success: false,
      };
    }
  };

const sendEmail = createSendEmail(resendTransport);

export { createSendEmail, sendEmail };

export type { SendEmailTransport };
